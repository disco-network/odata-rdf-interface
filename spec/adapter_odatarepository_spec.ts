import { assert } from "chai";
import results = require("../src/result");
import schema = require("../src/odata/schema");
import postQueries = require("../src/adapter/postquery");
import {
  ODataRepository, IGetQueryStringBuilder, IQueryAdapterModel, IMinimalVisitor,
} from "../src/adapter/odatarepository";
import sparqlProviderBase = require("../src/sparql/sparql_provider_base");

import queryTestCases = require("./helpers/querytestcases");

describe("Adapter.ODataRepository (generated insertion tests):", () => {
  queryTestCases.odataRepositoryQueryTests.forEach(
    (args, i) => spec(`#${i}`, args)
  );

  function spec(name: string, args: queryTestCases.IODataRepositoryTestCase) {
    it(name, (done) => {
      let myPostQueryStringBuilder = new PostQueryStringBuilder();
      myPostQueryStringBuilder.build = (entity, type) => {
        assert.deepEqual(entity, args.entity);
        assert.strictEqual(type.getName(), "Post");
        return args.sparql;
      };
      let mySparqlProvider = new SparqlProvider();
      let sparqlQueryCount = 0;
      mySparqlProvider.query = (query, cb) => {
        ++sparqlQueryCount;
        assert.strictEqual(query, args.sparql);
        cb(results.Result.success("ok"));
      };

      let myODataProvider = create(mySparqlProvider, new GetQueryStringBuilder(), myPostQueryStringBuilder);
      myODataProvider.insertEntity(args.entity, args.entityType, result => {
        assert.strictEqual(result.success(), true);
        assert.strictEqual(sparqlQueryCount, 1);
        done();
      });
    });
  }
});

function create<T extends IMinimalVisitor>(sparqlProvider: sparqlProviderBase.ISparqlProvider,
                                           getQueryStringBuilder: IGetQueryStringBuilder<T>,
                                           postQueryStringBuilder: postQueries.IQueryStringBuilder) {
  return new ODataRepository<T>(sparqlProvider, getQueryStringBuilder, postQueryStringBuilder);
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

class SparqlProvider implements sparqlProviderBase.ISparqlProvider {
  public querySelect() {
    //
  }

  public query(query: string, cb: (result: results.AnyResult) => void) {
    //
  }
}
