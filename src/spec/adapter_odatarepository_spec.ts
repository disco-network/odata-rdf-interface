import { assert, assertEx, match } from "../lib/assert";
import results = require("../lib/result");
import { Schema, EntityType } from "../lib/odata/schema";
import {
  ODataRepository, IGetQueryStringBuilder, IQueryAdapterModel, IMinimalVisitor, IPatchQueryStringProducerFactory,
  PatchQueryStringProducerFactory, IWhereClauseProducer, WhereClause,
} from "../lib/adapter/odatarepository";
import {
  LiteralValuedEntity, OnlyExistingPropertiesBrand, CorrectPropertyTypesBrand,
} from "../lib/odata/repository";
import sparqlProviderBase = require("../lib/sparql/sparql_provider_base");
import {
  IInsertQueryStringProducer, IPrefix, ISparqlLiteral, PropertyDescription,
} from "../lib/sparql/querystringproducer";
import { tryCatch } from "../lib/controlflow";
import { IFilterFromPatternProducer } from "../lib/odata/filters/matchpattern";

describe("Adapter.ODataRepository:", () => {
  it("should insert an entity called 'post1' with Id = '1'", done => {
    const sparql = "INSERT {SOMETHING}";
    let queryModel: IQueryAdapterModel<{}>;

    const mySparqlProvider = new SparqlProvider();
    let sparqlQueryCount = 0;
    mySparqlProvider.query = (query, cb) => {
      ++sparqlQueryCount;
      if (sparqlQueryCount === 1) {
        assert.strictEqual(query, sparql);
        cb(results.Result.success("ok"));
      }
      else if (sparqlQueryCount === 2) {
        assert.strictEqual(query, "SELECT {SOMETHING}");
        cb(results.Result.success([{
          [queryModel.getMapping().variables.getVariable().substr(1)]: { value: "uri" },
          [queryModel.getMapping().variables.getElementaryPropertyVariable("Id").substr(1)]: { value: "new" },
        }]));
      }
    };

    const insertQueryStringBuilder = new InsertQueryStringBuilder();
    insertQueryStringBuilder.insertAsSparql = (prefixes, uri, rdfType, properties) => {
      assert.strictEqual(uri, "post10");
      assertEx.deepEqual(properties, [
        { rdfProperty: "disco:id", inverse: false, value: match.is(val => val.representAsSparql() === "'10'") },
      ]);
      return "INSERT {SOMETHING}";
    };

    const getStringProducer = new GetQueryStringBuilder();
    getStringProducer.fromQueryAdapterModel = model => {
      queryModel = model;
      return "SELECT {SOMETHING}";
    };

    const odataRepository = create(mySparqlProvider, getStringProducer,
                                   insertQueryStringBuilder, {} as IPatchQueryStringProducerFactory);
    odataRepository.batch([{
      type: "insert",
      entityType: "Post",
      identifier: "post10",
      value: {
        Id: { type: "Edm.String", value: "10" },
      },
    }], new Schema(), results => {
      assert.strictEqual(results.success(), true);
      assert.deepEqual(results.result()[0].result().odata, [{
        "odata.id": "http://disco-node.local/api/odata/Posts(new)",
        Id: "new",
        ContentId: null,
        ParentId: null,
      }]);
      assert.strictEqual(sparqlQueryCount, 2);
      done();
    });
  });

  xit("should insert an entity referencing to Post #1", done => {
    const sparql = "INSERT {SOMETHING}";

    const mySparqlProvider = new SparqlProvider();
    let sparqlQueryCount = 0;
    mySparqlProvider.query = (query, cb) => {
      switch (sparqlQueryCount) {
        case 0:
          assert.strictEqual(query, sparql /* @todo */);
          cb(results.Result.success([{

          }]));
          break;
        case 1:
          assert.strictEqual(query, sparql);
          cb(results.Result.success("ok"));
        break;
        default:
          assert.strictEqual("sparqlQueryCount", "valid");
          break;
      }
      ++sparqlQueryCount;
    };

    const insertQueryStringBuilder = new InsertQueryStringBuilder();
    insertQueryStringBuilder.insertAsSparql = (prefixes, uri, rdfType, properties) => {
      assert.strictEqual(uri, "post10");
      assertEx.deepEqual(properties, [
        { rdfProperty: "disco:id", value: match.is(val => val.representAsSparql() === "'10'") },
      ]);
      return "INSERT {SOMETHING}";
    };

    const odataRepository = create(mySparqlProvider, new GetQueryStringBuilder(),
                                 insertQueryStringBuilder, {} as IPatchQueryStringProducerFactory);
    odataRepository.batch([{
      type: "insert",
      entityType: "Post",
      identifier: "post10",
      value: {
        Id: { type: "Edm.String", value: "10" },
      },
    }], new Schema(), results => {
      assert.strictEqual(results.success(), true);
      assert.strictEqual(results.result(), "@todo dunno");
      assert.strictEqual(sparqlQueryCount, 1);
      done();
    });
  });

  it ("should execute a basic 'patch'", done => {
    const sparql =
    `DELETE { <x> disco:title ?x0 } INSERT { <x> disco:title 'new' } WHERE { ?x1 disco:id '1' . ?x1 disco:title ?x0 }`;

    const sparqlProvider = new SparqlProvider();
    let queryCount = 0;
    sparqlProvider.query = tryCatch((query, cb) => {
      switch (queryCount++) {
        case 0:
          assert.strictEqual(query, sparql);
          cb(results.Result.success(undefined));
          break;
        default:
          assert.strictEqual("queryCount", "valid");
      }
    }, e => { done(e); done = () => null; });

    const patchQueryStringBuilderFactory: IPatchQueryStringProducerFactory = {
      create: (updatedValues, pattern, entityType) => ({
        produceSparql: tryCatch(() => {
          assertEx.deepEqual(updatedValues, [match.is(v => {
            return v.value.representAsSparql() === "'new'";
          })]);
          return sparql;
        }, e => { done(e); done = () => null; }),
      }),
    };

    const repo = create(sparqlProvider, new GetQueryStringBuilder(), new InsertQueryStringBuilder(),
                        patchQueryStringBuilderFactory);

    const pattern = { Id: { type: "Edm.Int32", value: 1 } } as
      LiteralValuedEntity as LiteralValuedEntity & OnlyExistingPropertiesBrand & CorrectPropertyTypesBrand;

    const diff = { Title: { type: "Edm.String", value: "new" } } as
      LiteralValuedEntity as LiteralValuedEntity & OnlyExistingPropertiesBrand & CorrectPropertyTypesBrand;
    try {
      repo.batch([{
        type: "patch",
        entityType: "Content",
        pattern: pattern,
        diff: diff,
      }], new Schema(), tryCatch(() => {
        assert.strictEqual(queryCount, 1);
        done();
      }, done));
    }
    catch (e) {
      done(e);
    }
  });
  it ("should execute 'patch' with foreign-key properties", done => {
    const sparql =
    `DELETE { ?x2 disco:content ?x1 } INSERT { ?x2 disco:content ?x0 } WHERE { ?x2 disco:id '1' . ?x2 disco:content ?x1 . ?x0 rdf:type disco:Content . ?x0 disco:id '1' }`;

    const sparqlProvider = new SparqlProvider();
    let queryCount = 0;
    sparqlProvider.query = tryCatch((query, cb) => {
      switch (queryCount++) {
        case 0:
          assert.strictEqual(query, sparql);
          cb(results.Result.success(undefined));
          break;
        default:
          assert.strictEqual("queryCount", "valid");
      }
    }, e => { done(e); done = () => null; });

    const patchQueryStringBuilderFactory: IPatchQueryStringProducerFactory = {
      create: (updatedValues, pattern, entityType) => ({
        produceSparql: tryCatch(() => {
          assertEx.deepEqual(updatedValues, [match.is(v => {
            return v.value.representAsSparql() === "'1'";
          })]);
          return sparql;
        }, e => { done(e); done = () => null; }),
      }),
    };

    const repo = create(sparqlProvider, new GetQueryStringBuilder(), new InsertQueryStringBuilder(),
                        patchQueryStringBuilderFactory);

    const pattern = { Id: { type: "Edm.Int32", value: 1 } } as
      LiteralValuedEntity as LiteralValuedEntity & OnlyExistingPropertiesBrand & CorrectPropertyTypesBrand;

    const diff = { ContentId: { type: "Edm.Int32", value: 1 } } as
      LiteralValuedEntity as LiteralValuedEntity & OnlyExistingPropertiesBrand & CorrectPropertyTypesBrand;
    try {
      repo.batch([{
        type: "patch",
        entityType: "Content",
        pattern: pattern,
        diff: diff,
      }], new Schema(), tryCatch(() => {
        assert.strictEqual(queryCount, 1);
        done();
      }, done));
    }
    catch (e) {
      done(e);
    }
  });
});

describe ("PatchQueryStringProducer:", () => {
  it ("should", () => {
    const whereClauseProducer: IWhereClauseProducer = {
      produce: (properties, filter, type, mapping) => {
        return "[WHERE]" as string & WhereClause;
      },
    };

    const filterFromPatternProducer: IFilterFromPatternProducer = {
      produceFromPattern: (pattern, entityType) => {
        return null as any;
      },
    };

    const factory = new PatchQueryStringProducerFactory({
      prefixesAsSparql: prefixes => "[PREFIXES]",
    }, whereClauseProducer, filterFromPatternProducer);

    const producer = factory.create(
      [],
      [{ property: "Id", value: { type: "Edm.String", value: "1" } }],
      new Schema().getEntityType("Post"));

    assert.strictEqual(producer.produceSparql(), "[PREFIXES] DELETE {  } INSERT {  } [WHERE]");
  });

});

function create<T extends IMinimalVisitor>(sparqlProvider: sparqlProviderBase.ISparqlProvider,
                                           getQueryStringBuilder: IGetQueryStringBuilder<T>,
                                           insertQueryStringBuilder: IInsertQueryStringProducer,
                                           patchQueryStringBuilderFactory: IPatchQueryStringProducerFactory) {
  return new ODataRepository<T>(sparqlProvider, getQueryStringBuilder,
                                insertQueryStringBuilder, patchQueryStringBuilderFactory);
}

class PostQueryStringBuilder /*implements postQueries.IQueryStringBuilder*/ {
  public build(entity, type: EntityType): any {
    //
  }
}

class GetQueryStringBuilder<T> implements IGetQueryStringBuilder<T> {
  public fromQueryAdapterModel(model: IQueryAdapterModel<T>) {
    //
  }
}

class InsertQueryStringBuilder implements IInsertQueryStringProducer {
  public insertAsSparql(prefixes: IPrefix[], uri: string, rdfType: ISparqlLiteral,
                        properties: PropertyDescription[]): any {
    //
  }
  public updateAsSparql(prefixes: IPrefix[], uri: string,
                        obsoleteProperties: PropertyDescription[], newProperties: PropertyDescription[],
                        pattern: PropertyDescription[]): any {
    //
  }
}

class SparqlProvider implements sparqlProviderBase.ISparqlProvider {

  public query(query: string, cb: (result: results.AnyResult) => void) {
    //
  }
}
