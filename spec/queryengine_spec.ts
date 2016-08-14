import { assert } from "chai";
import { stub, match } from "sinon";

import { GetHandler, PostHandler } from "../src/odata/queryengine";
import { IPostRequestParser, IGetRequestParser } from "../src/odata/parser";
import { IEntityInitializer } from "../src/odata/entity_reader_base";
import { IRepository } from "../src/odata/repository";
import { Result, AnyResult } from "../src/result";
import { Schema, EntityType } from "../src/odata/schema";
import { IHttpRequest, IHttpResponseSender } from "../src/odata/http";

import queryTestCases = require("./helpers/querytestcases");

describe("OData.PostHandler:", () => {

  postQuery("should insert an entity and send an empty response, sending exactly one body",
    queryTestCases.postQueryTests[0]);
  function postQuery(test: string, args: queryTestCases.IPostQueryTestCase) {
    it(test, done => {
      let parser = new PostRequestParser();
      stub(parser, "parse")
        .withArgs({ relativeUrl: args.query, body: args.body })
        .returns({ entitySetName: args.entitySetName, entity: args.parsedEntity });

      let entityReader = new EntityInitializer();
      stub(entityReader, "fromParsed")
        .withArgs(args.parsedEntity, match(type => type.getName() === "Post"))
        .returns(args.entity);

      let repository = new Repository();
      let insertEntity = stub(repository, "insertEntity")
        .withArgs(args.entity, match(type => type.getName() === "Post"))
        .callsArgWith(2, Result.success("ok"));

      let responseSender = new HttpResponseSender();
      let sendBody = stub(responseSender, "sendBody");
      stub(responseSender, "finishResponse", () => {
        assert.strictEqual(sendBody.calledOnce, true);
        assert.strictEqual(insertEntity.calledOnce, true);
        done();
      });

      let engine = new PostHandler(parser, entityReader, repository);
      engine.setSchema(new Schema());

      engine.query({ relativeUrl: args.query, body: args.body }, responseSender);
    });
  }
});

describe("OData.GetHandler", () => {
  it("should return a complete entity set in JSON, sending exactly one body", done => {
    let parser = new GetRequestParser();
    stub(parser, "parse")
      .withArgs({ relativeUrl: "/Posts", body: "" })
      .returns({
        entitySetName: "Posts",
        filterTree: null,
        expandTree: null,
      });
    let repository = new Repository();
    stub(repository, "getEntities")
      .withArgs(match(type => type.getName() === "Post"), null, null, match.any)
      .callsArgWith(3, Result.success([ { Id: "1" } ]));

    let schema = new Schema();
    let getHandler = new GetHandler(schema, parser, repository);

    getHandler.query({ relativeUrl: "/Posts", body: "" }, responseSenderWithAssertions());

    function responseSenderWithAssertions() {
      let responseSender = new HttpResponseSender();
      let sendBody = stub(responseSender, "sendBody", body => {
        assert.deepEqual(JSON.parse(body), [ { Id: "1" } ]);
      });
      stub(responseSender, "finishResponse", () => {
        assert.strictEqual(sendBody.calledOnce, true, "body should be sent exactly once");
        done();
      });
      return responseSender;
    }
  });

  it("should return an expanded entity set, sending exactly one body", done => {
    let parser = new GetRequestParser();
    stub(parser, "parse")
      .withArgs({ relativeUrl: "/Posts?$expand=Children", body: "" })
      .returns({
        entitySetName: "Posts",
        filterTree: null,
        expandTree: { Children: {} },
      });

    let repository = new Repository();
    stub(repository, "getEntities")
      .withArgs(match(type => type.getName() === "Post"), { Children: {} }, null, match.any)
      .callsArgWith(3, Result.success([ { Id: "2" } ]));

    let schema = new Schema();
    let getHandler = new GetHandler(schema, parser, repository);

    getHandler.query({ relativeUrl: "/Posts?$expand=Children", body: "" }, responseSenderWithAssertions());

    function responseSenderWithAssertions() {
      let responseSender = new HttpResponseSender();
      let sendBody = stub(responseSender, "sendBody", body => {
        assert.deepEqual(JSON.parse(body), [ { Id: "2" } ]);
      });
      stub(responseSender, "finishResponse", () => {
        assert.strictEqual(sendBody.calledOnce, true, "body should be sent exactly once");
        done();
      });
      return responseSender;
    }
  });
});

class PostRequestParser implements IPostRequestParser {
  public parse(request: IHttpRequest): any {
    //
  }
}

class GetRequestParser implements IGetRequestParser {
  public parse(request: IHttpRequest): any {
    //
  }
}

class EntityInitializer implements IEntityInitializer {
  public fromParsed(entity: any, entityType: EntityType): any {
    //
  }
}

class HttpResponseSender implements IHttpResponseSender {
  public sendHeader(key: string, value: string) {
    //
  }

  public sendBody(body: string) {
    //
  }

  public finishResponse() {
    //
  }
}

class Repository implements IRepository {

  public getEntities(entityType: EntityType, filterAst: any, cb: (result: Result<any[], any>) => void) {
    //
  }

  public insertEntity(entity: any, type: EntityType, cb: (result: AnyResult) => void) {
    //
  }
}
