import { assert, assertEx, match } from "../src/assert";
import results = require("../src/result");
import schema = require("../src/odata/schema");
import postQueries = require("../src/adapter/postquery");
import {
  ODataRepository, IGetQueryStringBuilder, IQueryAdapterModel, IMinimalVisitor,
} from "../src/adapter/odatarepository";
import sparqlProviderBase = require("../src/sparql/sparql_provider_base");
import { IInsertQueryStringBuilder, IPrefix, ISparqlLiteral } from "../src/sparql/querystringbuilder";

describe("Adapter.ODataRepository:", () => {
  it("should insert an entity called 'post1' with Id = '1'", done => {
    const sparql = "INSERT {SOMETHING}";
    let queryModel: IQueryAdapterModel<{}>;

    const myPostQueryStringBuilder = new PostQueryStringBuilder();

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
    insertQueryStringBuilder.insertAsSparql = (prefixes, uri, properties) => {
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

    const odataRepository = create(mySparqlProvider, getStringProducer, myPostQueryStringBuilder,
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

    let myPostQueryStringBuilder = new PostQueryStringBuilder();

    let mySparqlProvider = new SparqlProvider();
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

    let insertQueryStringBuilder = new InsertQueryStringBuilder();
    insertQueryStringBuilder.insertAsSparql = (prefixes, uri, properties) => {
      assert.strictEqual(uri, "post10");
      assertEx.deepEqual(properties, [
        { rdfProperty: "disco:id", value: match.is(val => val.representAsSparql() === "'10'") },
      ]);
      return "INSERT {SOMETHING}";
    };

    let odataRepository = create(mySparqlProvider, new GetQueryStringBuilder(), myPostQueryStringBuilder,
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
});

function create<T extends IMinimalVisitor>(sparqlProvider: sparqlProviderBase.ISparqlProvider,
                                           getQueryStringBuilder: IGetQueryStringBuilder<T>,
                                           postQueryStringBuilder: postQueries.IQueryStringBuilder,
                                           insertQueryStringBuilder: IInsertQueryStringBuilder) {
  return new ODataRepository<T>(sparqlProvider, getQueryStringBuilder, postQueryStringBuilder,
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
  public insertAsSparql(prefixes: IPrefix[], uri: string,
                        properties: { rdfProperty: string, value: ISparqlLiteral }[]): any {
    //
  }
}

class SparqlProvider implements sparqlProviderBase.ISparqlProvider {

  public query(query: string, cb: (result: results.AnyResult) => void) {
    //
  }
}
