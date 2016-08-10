import { assert } from "chai";

import odataParser = require("../src/odata/parser");
import entityReader = require("../src/odata/entity_reader_base");
import repository = require("../src/odata/repository");
import queryEngine = require("../src/odata/query_engine");
import results = require("../src/result");
import schema = require("../src/odata/schema");

import queryTestCases = require("./helpers/querytestcases");

describe("OData.QueryEngine:", () => {
  xit("process a GET query", () => {
    let parser = new ODataParser();
    parser.parse = query => {
      assert.strictEqual(query, "/Posts");
      return { type: "resourceQuery" };
    };
    let repository = new Repository();
    /* @construction add getEntities() method to IRepository */
    let engine = new queryEngine.QueryEngine(parser, new EntityReader(), repository);

    engine.queryGET("/Posts", result => {
      assert.isDefined(result.result());
      assert.isUndefined(result.error());
      assert.deepEqual(result.result(), {
        bla: "blub",
      });
    });
  });

  postQuery("process a POST query", queryTestCases.postQueryTests[0]);
  function postQuery(test: string, args: queryTestCases.IPostQueryTestCase) {
    it(test, done => {
      let parser = new ODataParser();
      parser.parse = query => {
        assert.strictEqual(query, "/Posts");
        return args.ast;
      };
      let entityReader = new EntityReader();
      entityReader.fromJson = (body, type) => {
        assert.strictEqual(body, args.body);
        assert.strictEqual(type.getName(), "Post");
        return args.entity;
      };
      let repository = new Repository();
      let insertionCounter = 0;
      repository.insertEntity = (entity, type, cb) => {
        assert.strictEqual(entity, args.entity);
        assert.strictEqual(type.getName(), "Post");
        ++insertionCounter;
        cb(results.Result.success("ok"));
      };
      let engine = new queryEngine.QueryEngine(parser, entityReader, repository);
      engine.setSchema(new schema.Schema());

      engine.queryPOST(args.query, args.body, result => {
        assert.strictEqual(result.success(), true);
        assert.strictEqual(insertionCounter, 1);
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
