import odataParser = require("../src/odata/parser");
import entityReader = require("../src/odata/entity_reader_base");
import repository = require("../src/odata/repository");
import queryEngine = require("../src/odata/query_engine");
import results = require("../src/result");
import schema = require("../src/odata/schema");

import queryTestCases = require("./helpers/querytestcases");

describe("OData.QueryEngine:", () => {
  queryAstTypeJsonEntity("process a POST query", queryTestCases.postQueryTests[0]);
  function queryAstTypeJsonEntity(test: string, args: queryTestCases.IPostQueryTestCase) {
    it(test, done => {
      let parser = new ODataParser();
      parser.parse = query => {
        expect(query).toBe("/Posts");
        return args.ast;
      };
      let entityReader = new EntityReader();
      entityReader.fromJson = (body, type) => {
        expect(body).toBe(args.body);
        expect(type.getName()).toBe("Post");
        return args.entity;
      };
      let repository = new Repository();
      let insertionCounter = 0;
      repository.insertEntity = (entity, type, cb) => {
        expect(entity).toEqual(args.entity);
        expect(type.getName()).toBe("Post");
        ++insertionCounter;
        cb(results.Result.success("ok"));
      };
      let engine = new queryEngine.QueryEngine(parser, entityReader, repository);
      engine.setSchema(new schema.Schema());

      engine.queryPOST(args.query, args.body, result => {
        expect(result.success()).toBe(true);
        expect(insertionCounter).toBe(1);
        done();
      });
    });
  }
});

class ODataParser implements odataParser.IODataParser {
  public parse(query: string): any {
    //
  }
}

class EntityReader implements entityReader.IEntityReader {
  public fromJson(json: string, entityType: schema.EntityType): any {
    //
  }
}

class Repository implements repository.IRepository {
  public insertEntity(entity: any, type: schema.EntityType, cb: (result: results.AnyResult) => void) {
    //
  }
}
