import { assert, assertEx, match } from "../src/assert";
import results = require("../src/result");
import schema = require("../src/odata/schema");
import {
  ODataRepository, IGetQueryStringBuilder, IQueryAdapterModel, IMinimalVisitor,
} from "../src/adapter/odatarepository";
import {
  LiteralValuedEntity, OnlyExistingPropertiesBrand, CorrectPropertyTypesBrand, BatchEntity,
} from "../src/odata/repository";
import sparqlProviderBase = require("../src/sparql/sparql_provider_base");
import {
  IInsertQueryStringBuilder, IPrefix, ISparqlLiteral, PropertyDescription } from "../src/sparql/querystringbuilder";

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
                                   insertQueryStringBuilder);
    odataRepository.batch([{
      type: "insert",
      entityType: "Post",
      identifier: "post10",
      value: {
        Id: { type: "Edm.String", value: "10" },
      },
    }], new schema.Schema(), results => {
      assert.strictEqual(results.success(), true);
      assert.deepEqual(results.result()[0].result().odata, [{
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
                                 insertQueryStringBuilder);
    odataRepository.batch([{
      type: "insert",
      entityType: "Post",
      identifier: "post10",
      value: {
        Id: { type: "Edm.String", value: "10" },
      },
    }], new schema.Schema(), results => {
      assert.strictEqual(results.success(), true);
      assert.strictEqual(results.result(), "@todo dunno");
      assert.strictEqual(sparqlQueryCount, 1);
      done();
    });
  });

  it ("should execute a basic 'patch'", done => {
    const sparql =
    `DELETE { <x> disco:title ?x0 } INSERT { <x> disco:title 'new' } WHERE { <x> disco:id '1' . <x> disco:title ?x0 }`;

    const sparqlProvider = new SparqlProvider();
    let queryCount = 0;
    sparqlProvider.query = (query, cb) => {
      switch (queryCount) {
        case 0:
          assert.strictEqual(query, sparql);
          cb(results.Result.success(undefined));
          break;
        default:
          assert.strictEqual("queryCount", "valid");
      }
    };

    const queryStringBuilder = new InsertQueryStringBuilder();
    queryStringBuilder.updateAsSparql = (prefixes, uri, obsoleteProperties, newProperties, pattern) => {
      assert.strictEqual(uri, "x");
      assertEx.deepEqual(obsoleteProperties,
        [{ rdfProperty: "disco:title", value: match.is(val => val.representAsSparql() === "?x0") }]);
      assertEx.deepEqual(newProperties,
        [{ rdfProperty: "disco:title", value: match.is(val => val.representAsSparql() === "'new'") }]);
      assertEx.deepEqual(pattern,
        [{ rdfProperty: "disco:id", value: match.is(val => val.representAsSparql() === "'1'") },
          { rdfProperty: "disco:title", value: match.is(val => val.representAsSparql() === "?x0") }]);
      return sparql;
    };

    const repo = create(sparqlProvider, new GetQueryStringBuilder(), queryStringBuilder);

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
      }], new schema.Schema(), () => {
        assert.strictEqual(queryCount, 1);
        done();
      });
    }
    catch (e) {
      done(e);
    }
  });
});

function create<T extends IMinimalVisitor>(sparqlProvider: sparqlProviderBase.ISparqlProvider,
                                           getQueryStringBuilder: IGetQueryStringBuilder<T>,
                                           insertQueryStringBuilder: IInsertQueryStringBuilder) {
  return new ODataRepository<T>(sparqlProvider, getQueryStringBuilder,
                                insertQueryStringBuilder);
}

class PostQueryStringBuilder /*implements postQueries.IQueryStringBuilder*/ {
  public build(entity, type: schema.EntityType): any {
    //
  }
}

class GetQueryStringBuilder<T> implements IGetQueryStringBuilder<T> {
  public fromQueryAdapterModel(model: IQueryAdapterModel<T>) {
    //
  }
}

class InsertQueryStringBuilder implements IInsertQueryStringBuilder {
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
