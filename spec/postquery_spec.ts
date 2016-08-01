// import postQueries = require("../src/odata/postquery");
import odataQueryEngine = require("../src/odata/query_engine");
import odataParser = require("../src/odata/odata_parser_base");
import entityReader = require("../src/odata/entity_reader_base");
import odataProviderBase = require("../src/odata/data_provider");
import odataProvider = require("../src/adapter/odata_provider");
import sparqlProviderBase = require("../src/sparql/sparql_provider_base");
import postQueries = require("../src/adapter/postquery");
import results = require("../src/result");
import schema = require("../src/odata/schema");

let queries = [
  "/Posts",
  "/Content",
];

let jsonStrings = [
  JSON.stringify({
    ContentId: "1",
  }),
  JSON.stringify({
    Title: "MyContent",
  }),
];

let asts = [
  {
    type: "resourceQuery",
    resourcePath: {
      type: "entitySet",
      entitySetName: "Posts",
    },
  },
  {
    type: "resourceQuery",
    resourcePath: {
      type: "entitySet",
      entitySetName: "Content",
    },
  },
];

let entities = [
  {
    Id: "3",
    ContentId: "1",
  },
  {
    Id: "3",
    Title: "MyContent",
  },
];

let types = [
  new schema.Schema().getEntityType("Post"),
  new schema.Schema().getEntityType("Content"),
];

let sparqlStrings = [
  "PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> " +
      "PREFIX disco: <http://disco-network.org/resource/> " +
      "INSERT DATA { ?x0 rdf:type disco:Post . ?x0 disco:id '3' . ?x0 disco:content ?x1 } WHERE { ?x1 disco:id '1' }",
  "PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> " +
      "PREFIX disco: <http://disco-network.org/resource/> " +
      "INSERT DATA { ?x0 rdf:type disco:Content . ?x0 disco:id '3' . ?x0 disco:title 'MyContent' }",
];

describe("OData.QueryEngine:", () => {
  queryAstTypeJsonEntity("process a POST query", queries[0], asts[0], types[0], jsonStrings[0], entities[0]);
  function queryAstTypeJsonEntity(test: string, queryString: string, ast, entityType: schema.EntityType, json: string,
                                  entityObject) {
    it(test, done => {
      let odataQuery = "/Posts";
      let engine = new odataQueryEngine.QueryEngineImpl();
      let parser = new ODataParser();
      parser.parsePOST = query => {
        expect(query).toBe("/Posts");
        return ast;
      };
      let entityReader = new EntityReader();
      entityReader.fromJson = (jsonInput, type) => {
        expect(jsonInput).toBe(json);
        expect(type.getName()).toBe("Post");
        return entityObject;
      };
      let dataProvider = new DataProvider();
      let insertionCounter = 0;
      dataProvider.insertEntity = (entity, type, cb) => {
        expect(entity).toEqual(entity);
        expect(type.getName()).toBe("Post");
        ++insertionCounter;
        cb(results.Result.success("ok"));
      };
      engine.setODataParser(parser);
      engine.setEntityReader(entityReader);
      engine.setDataProvider(dataProvider);
      engine.setSchema(new schema.Schema());

      engine.queryPOST(odataQuery, json, result => {
        expect(result.success()).toBe(true);
        expect(insertionCounter).toBe(1);
        done();
      });
    });
  }
});

describe("Adapter.ODataProvider:", () => {
  it("process a POST query", (done) => {
    let myODataProvider = new odataProvider.ODataProvider();
    let myPostQueryStringBuilder = new PostQueryStringBuilder();
    myPostQueryStringBuilder.build = (entity, type) => {
      expect(entity).toEqual(entities[0]);
      expect(type.getName()).toBe("Post");
      return sparqlStrings[0];
    };
    let mySparqlProvider = new SparqlProvider();
    let sparqlQueryCount = 0;
    mySparqlProvider.query = (query, cb) => {
      ++sparqlQueryCount;
      expect(query).toBe(sparqlStrings[0]);
      cb(results.Result.success("ok"));
    };

    myODataProvider.setSparqlProvider(mySparqlProvider);
    myODataProvider.setPostQueryStringBuilder(myPostQueryStringBuilder);

    myODataProvider.insertEntity(entities[0], types[0], result => {
      expect(result.success());
      expect(sparqlQueryCount).toBe(1);
      done();
    });
  });
});

describe("PostQueryStringBuilder:", () => {
  it("build a query string for inserting a Content", () => {
    let builder = new postQueries.QueryStringBuilder();
    expect(builder.build(entities[1], types[1])).toBe(sparqlStrings[1]);
  });
});

class ODataParser implements odataParser.ODataParserBase {
  public parsePOST(query: string): any {
    //
  }
}

class EntityReader implements entityReader.EntityReaderBase {
  public fromJson(json: string, entityType: schema.EntityType): any {
    //
  }
}

class DataProvider implements odataProviderBase.DataProviderBase {
  public insertEntity(entity: any, type: schema.EntityType, cb: (result: results.AnyResult) => void) {
    //
  }
}

class SparqlProvider implements sparqlProviderBase.SparqlProviderBase {
  public querySelect() {
    //
  }

  public query(query: string, cb: (result: results.AnyResult) => void) {
    //
  }
}

class PostQueryStringBuilder implements postQueries.QueryStringBuilderBase {
  public build(entity, type: schema.EntityType): any {
    //
  }
}
