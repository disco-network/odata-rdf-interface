// import postQueries = require("../src/odata/postquery");
import queryEngine = require("../src/adapter/query_engine");
import sparqlProvider = require("../src/sparql/sparql_provider_base");
import odataParser = require("../src/odata/odata_parser_base");
import entityReader = require("../src/odata/entity_reader_base");
import postQueries = require("../src/adapter/postquery");
import results = require("../src/result");
import schema = require("../src/odata/schema");

describe("QueryEngine:", () => {
  it("process a POST query", done => {
    let odataQuery = "/Posts";
    let engine = new queryEngine.QueryEngine();
    let ast = {
      type: "resourceQuery",
      resourcePath: {
        type: "entitySet",
        entitySetName: "Posts",
      },
    };
    let parser = new ODataParser();
    parser.parsePOST = query => {
      expect(query).toBe("/Posts");
      return ast;
    };
    let json = {
      ContentId: "1",
    };
    let entityObject = {
      Id: "3",
      ContentId: "1",
    };
    let entityReader = new EntityReader();
    entityReader.fromJson = (jsonInput, type) => {
      expect(jsonInput).toBe(json);
      expect(type.getName()).toBe("Post");
      return entityObject;
    };
    let queryString = "PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> " +
      "PREFIX disco: <http://disco-network.org/resource/> " +
      "INSERT DATA { ?x0 rdf:type disco:Post . ?x0 disco:id '3' . ?x0 disco:content ?x1 } WHERE { ?x1 disco:id '1' }";
    let queryStringBuilder = new QueryStringBuilder();
    queryStringBuilder.build = (entity, type) => {
      expect(entity).toEqual(entityObject);
      expect(type.getName()).toEqual("Post");
      return queryString;
    };
    let provider = new SparqlProvider();
    let queryCounter = 0;
    provider.query = (query, cb) => {
      ++queryCounter;
      expect(query).toBe(queryString);
      setTimeout(() => cb(results.Result.success("xyz")));
    };
    engine.setSparqlProvider(provider);
    engine.setODataParser(parser);
    engine.setEntityReader(entityReader);
    engine.setPostQueryStringBuilder(queryStringBuilder);

    engine.queryPOST(odataQuery, result => {
      expect(result.success()).toBe(true);
      expect(queryCounter).toBe(1);
      done();
    });
  });
});

class SparqlProvider implements sparqlProvider.SparqlProviderBase {
  public querySelect(queryString: string, cb: (result: results.AnyResult) => void): void {
    throw new Error("not implemented");
  }

  public query(queryString: string, cb: (result: results.AnyResult) => void): void {
    //
  }
}

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

class QueryStringBuilder implements postQueries.QueryStringBuilder {
  public build(entity: any, type: schema.EntityType) {
    //
  }
}
