import { assert, assertEx, match as eqMatch } from "../src/assert";
import { stub, match } from "sinon";

import { GetHandler, PostHandler, IGetHttpResponder, GetHttpResponder } from "../src/odata/queryengine";
import { IPostRequestParser, IGetRequestParser, IFilterVisitor, GetRequestType } from "../src/odata/parser";
import { IEntityInitializer } from "../src/odata/entity_reader_base";
import { IRepository, IOperation } from "../src/odata/repository";
import { IValue } from "../src/odata/filters/expressions";
import { Result, AnyResult } from "../src/result";
import { Schema, EntityType } from "../src/odata/schema";
import { IHttpRequest, IHttpResponseSender } from "../src/odata/http";
import { IEqExpression, IPropertyValue, INumericLiteral } from "../src/odata/filters/expressions";

describe("OData.PostHandler:", () => {

  it("should send 201 Created", done => {
    let parser = new PostRequestParser();
    stub(parser, "parse").returns({ entitySetName: "Posts", entity: {} });
    let entityInitializer = new EntityInitializer();
    stub(entityInitializer, "fromParsed").returns([]);
    let repository = new Repository<IFilterVisitor>();
    stub(repository, "batch").callsArgWith(2, Result.success([Result.success({ odata: ["ok"] })]));

    let engine = new PostHandler(parser, entityInitializer, repository, new Schema());

    engine.query({ relativeUrl: "/Posts", body: "{}" }, httpSenderThatShouldReceiveStatusCode(201, done, "Created"));
  });

  it("should insert an entity and send a response with exactly one body containing the new entity", done => {
    let parser = new PostRequestParser();
    stub(parser, "parse")
      .withArgs({ relativeUrl: "/Posts", body: "{ ContentId: \"1\" }" })
      .returns({ entitySetName: "Posts", entity: { ContentId: "1" } });

    const ops = [{
        type: "get",
        entityType: "Post",
        pattern: {
          Id: "1",
        },
      }, {
        type: "insert",
        entityType: "Post",
        value: {
          Id: "3",
          Content: { type: "ref", resultIndex: 0 },
    }}];
    let entityReader = new EntityInitializer();
    stub(entityReader, "fromParsed")
      .withArgs({ ContentId: "1" }, match(type => type.getName() === "Post"))
      .returns(ops);

    let repository = new Repository<IFilterVisitor>();
    let batch = stub(repository, "batch")
      .withArgs(ops, match.any, match.any)
      .callsArgWith(2, Result.success([Result.success({}), Result.success({ odata: [{ newPost: true }] })]));

    let responseSender = new HttpResponseSender();
    let sendBody = stub(responseSender, "sendBody",
      body => assertEx.deepEqual(JSON.parse(body), {
        "odata.metadata": eqMatch.any,
        "value": { newPost: true } }));
    stub(responseSender, "finishResponse", () => {
      assert.strictEqual(sendBody.calledOnce, true);
      assert.strictEqual(batch.calledOnce, true);
      done();
    });

    let engine = new PostHandler(parser, entityReader, repository, new Schema());

    engine.query({ relativeUrl: "/Posts", body: "{ ContentId: \"1\" }" }, responseSender);
  });
});

describe("OData.GetHandler", () => {
  it("should return a single entity when requested /:set(:id)", done => {
    const parser = new GetRequestParser();
    parser.parse = request => {
      assert.strictEqual(request.relativeUrl, "/Content(1)");
      assert.strictEqual(request.body, "");
      return {
        type: GetRequestType.ById,
        entitySetName: "Content",
        id: 1,
      };
    };

    const schema = new Schema();

    const repository = new Repository<IFilterVisitor>();
    repository.getEntities = (type, expand, filter, cb) => {
      assert.strictEqual(type.getName(), "Content");
      assert.deepEqual(expand, {});
      filter!.accept({ visitEqExpression: (eq: IEqExpression<IFilterVisitor>) => {

        eq.getLhs().accept({ visitPropertyValue: (property: IPropertyValue<IFilterVisitor>) => {
          assert.deepEqual(property.getPropertyPath(), ["Id"]);
        } } as IFilterVisitor);

        eq.getRhs().accept({ visitNumericLiteral: (id: INumericLiteral<IFilterVisitor>) => {
          assert.strictEqual(id.getNumber(), 1);
        } } as IFilterVisitor);

      } } as IFilterVisitor);

      cb(Result.success(["ENTITY #1"]));
    };

    const responseSender = new GetResponseSenderStub();

    const getHandler = new GetHandler<IFilterVisitor>(schema, parser, repository, responseSender);

    let successCounter = 0;
    responseSender.success = entity => {
      ++successCounter;
      assert.deepEqual(entity, "ENTITY #1");
      assert.strictEqual(successCounter, 1);
      done();
    };

    getHandler.query({ relativeUrl: "/Content(1)", body: "" }, null as any);
  });

  it("should return a complete entity set in JSON, sending exactly one body", done => {
    let parser = new GetRequestParser();
    stub(parser, "parse")
      .withArgs({ relativeUrl: "/Posts", body: "" })
      .returns({
        entitySetName: "Posts",
        type: GetRequestType.Collection,
        filterExpression: null,
        expandTree: {},
      });
    let repository = new Repository<IFilterVisitor>();
    stub(repository, "getEntities")
      .withArgs(match(type => type.getName() === "Post"), {}, null, match.any)
      .callsArgWith(3, Result.success([ { Id: "1" } ]));

    let responseSender = new GetResponseSenderStub();
    stub(responseSender, "success", entities => {
      assert.deepEqual(entities, [ { Id: "1" } ]);
      done();
    });

    let schema = new Schema();
    let getHandler = new GetHandler<IFilterVisitor>(schema, parser, repository, responseSender);

    getHandler.query({ relativeUrl: "/Posts", body: "" }, null as any);
  });

  it("should return an expanded entity set, sending exactly one body", done => {
    let parser = new GetRequestParser();
    stub(parser, "parse")
      .withArgs({ relativeUrl: "/Posts?$expand=Children", body: "" })
      .returns({
        entitySetName: "Posts",
        type: GetRequestType.Collection,
        filterExpression: null,
        expandTree: { Children: {} },
      });

    let repository = new Repository<IFilterVisitor>();
    stub(repository, "getEntities")
      .withArgs(match(type => type.getName() === "Post"), { Children: {} }, null, match.any)
      .callsArgWith(3, Result.success([ { Id: "2" } ]));

    let responseSender = new GetResponseSenderStub();
    stub(responseSender, "success", entities => {
      assert.deepEqual(entities, [ { Id: "2" } ]);
      done();
    });

    let schema = new Schema();
    let getHandler = new GetHandler<IFilterVisitor>(schema, parser, repository, responseSender);

    getHandler.query({ relativeUrl: "/Posts?$expand=Children", body: "" }, null as any);
  });
});

describe("OData.GetResponseSender", () => {
  it("should send status code 200", done => {
    let storedCode = undefined;
    let httpSender = new HttpResponseSender();
    stub(httpSender, "sendStatusCode", code => {
      storedCode = code;
    });
    stub(httpSender, "finishResponse", () => {
      assert.strictEqual(storedCode, 200);
      done();
    });
    let responseSender = new GetHttpResponder();

    responseSender.success([], httpSenderThatShouldReceiveStatusCode(200, done));
  });
  it("should send CORS headers", done => {
    let httpSender = httpSenderThatShouldReceiveCorsHeaders(done);
    let responseSender = new GetHttpResponder();

    responseSender.success([], httpSender);
  });
  it("should send Content-Length and Content-Type headers", done => {
    let body = JSON.stringify({ "odata.metadata": "http://example.org/", value: [] }, null, 2);
    let httpSender = httpSenderThatShouldReceiveJsonContentHeaders(body.length.toString(), done);
    let responseSender = new GetHttpResponder();

    responseSender.success([], httpSender);
  });
  it("should send the request body with minimal metadata", done => {
    let body = JSON.stringify({ "odata.metadata": "http://example.org/", value: [] }, null, 2);
    let httpSender = httpSenderThatShouldReceiveRequestBody(
      body, done);
    let responseSender = new GetHttpResponder();

    responseSender.success([], httpSender);
  });
});

function httpSenderThatShouldReceiveCorsHeaders(done: () => void) {
  return httpSenderThatShouldReceiveHeaders([
    { key: "Access-Control-Allow-Origin", value: "*" },
    { key: "Access-Control-Expose-Headers", value: "MaxDataServiceVersion, DataServiceVersion" },
  ], done);
}

function httpSenderThatShouldReceiveJsonContentHeaders(length: string, done: () => void) {
  return httpSenderThatShouldReceiveHeaders([
    { key: "Content-Type", value: "application/json;charset=utf-8" },
    { key: "Content-Length", value: length },
  ], done);
}

function httpSenderThatShouldReceiveHeaders(expectedHeaders: { key: string; value: string; }[], done: () => void) {
  let headers = {};
  let httpSender = new HttpResponseSender();
  stub(httpSender, "sendHeader", (key, value) => {
    headers[key] = value;
  });
  stub(httpSender, "finishResponse", () => {
    for (let header of expectedHeaders) {
      assert.strictEqual(headers[header.key], header.value);
    }

    done();
  });
  return httpSender;
}

function httpSenderThatShouldReceiveStatusCode(code: number, done: () => void, message?: string) {
  let storedCode;
  let storedMessage;
  let httpSender: IHttpResponseSender = new HttpResponseSender();
  stub(httpSender, "sendStatusCode", (c, m?) => {
    storedCode = code;
    storedMessage = m;
  });
  stub(httpSender, "finishResponse", () => {
    assert.strictEqual(storedCode, code);
    if (message !== undefined) assert.strictEqual(storedMessage, message);
    done();
  });
  return httpSender;
}

function httpSenderThatShouldReceiveRequestBody(expectedBody: string, done: () => void) {
  let body: string = "";
  let httpSender = new HttpResponseSender();
  stub(httpSender, "sendBody", value => {
    body = value;
  });
  stub(httpSender, "finishResponse", () => {
    assert.strictEqual(body, expectedBody);

    done();
  });
  return httpSender;
}

class PostRequestParser implements IPostRequestParser {
  public parse(request: IHttpRequest): any {
    //
  }
}

class GetRequestParser implements IGetRequestParser<IFilterVisitor> {
  public parse(request: IHttpRequest): any {
    //
  }
}

class EntityInitializer implements IEntityInitializer {
  public fromParsed(entity: any, entityType: EntityType): any {
    //
  }
}

class GetResponseSenderStub implements IGetHttpResponder {
  public success(entities: any) {
    //
  }
}

class HttpResponseSender implements IHttpResponseSender {
  public sendStatusCode(code: number) {
    //
  }

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

class Repository<T> implements IRepository<T> {

  public getEntities(entityType: EntityType, expandTree: any, filter: IValue<T> | undefined,
                     cb: (result: Result<any[], any>) => void) {
    //
  }

  public insertEntity(entity: any, type: EntityType, cb: (result: AnyResult) => void) {
    //
  }

  public batch(ops: IOperation[], schema: Schema, cb: (result: AnyResult) => void) {
    //
  }
}
