import repository = require("../src/adapter/odatarepository");
import sparqlProviderBase = require("../src/sparql/sparql_provider_base");
import postQueries = require("../src/adapter/postquery");
import results = require("../src/result");
import schema = require("../src/odata/schema");

import queryTestCases = require("./helpers/querytestcases");

describe("Adapter.ODataRepository:", () => {
  it("process a POST query", (done) => {
    let args = queryTestCases.odataRepositoryQueryTests[0];
    let myODataProvider = new repository.ODataRepository();
    let myPostQueryStringBuilder = new PostQueryStringBuilder();
    myPostQueryStringBuilder.build = (entity, type) => {
      expect(entity).toEqual(args.entity);
      expect(type.getName()).toBe("Post");
      return args.sparql;
    };
    let mySparqlProvider = new SparqlProvider();
    let sparqlQueryCount = 0;
    mySparqlProvider.query = (query, cb) => {
      ++sparqlQueryCount;
      expect(query).toBe(args.sparql);
      cb(results.Result.success("ok"));
    };

    myODataProvider.setSparqlProvider(mySparqlProvider);
    myODataProvider.setPostQueryStringBuilder(myPostQueryStringBuilder);

    myODataProvider.insertEntity(args.entity, args.entityType, result => {
      expect(result.success());
      expect(sparqlQueryCount).toBe(1);
      done();
    });
  });
});

describe("PostQueryStringBuilder:", () => {
  xit("build a query string for inserting a Content", () => {
    /*let builder = new postQueries.QueryStringBuilder();
    expect(builder.build(entities[1], types[1])).toBe(sparqlStrings[1]);*/
  });
});

class SparqlProvider implements sparqlProviderBase.ISparqlProvider {
  public querySelect() {
    //
  }

  public query(query: string, cb: (result: results.AnyResult) => void) {
    //
  }
}

class PostQueryStringBuilder implements postQueries.IQueryStringBuilder {
  public build(entity, type: schema.EntityType): any {
    //
  }
}
