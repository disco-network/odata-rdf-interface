import odataParser = require("../odata/parser");
import entityReader = require("../odata/entity_reader_base");
import { IRepository }  from "../odata/repository";
import { Schema } from "../odata/schema";
import { IHttpRequest, IHttpRequestHandler, IHttpResponseSender } from "../odata/http";

export interface IGetHandler extends IHttpRequestHandler {
}

export interface IGetHttpResponder {
  success(entities: any[], responseSender: IHttpResponseSender): void;
}

export interface IPostHandler extends IHttpRequestHandler {
}

export interface IOptionsHandler extends IHttpRequestHandler {
}

export interface IPostRequestResult {
  success: boolean;
}

export class GetHandler<T> implements IGetHandler {

  constructor(private schema: Schema,
              private parser: odataParser.IGetRequestParser<T>,
              private repository: IRepository<T>,
              private getHttpResponder: IGetHttpResponder) {}

  public query(request: IHttpRequest, httpResponseSender: IHttpResponseSender) {
    let parsed = this.parser.parse(request);
    let type = this.schema.getEntitySet(parsed.entitySetName).getEntityType();
    this.repository.getEntities(type, parsed.expandTree, parsed.filterExpression, result => {
      this.getHttpResponder.success(result.result(), httpResponseSender);
    });
  }
}

export class GetHttpResponder implements IGetHttpResponder {

  public success(entityOrEntities: any, httpResponseSender: IHttpResponseSender) {
    httpResponseSender.sendStatusCode(200);

    httpResponseSender.sendHeader("Access-Control-Allow-Origin", "*");
    httpResponseSender.sendHeader("Access-Control-Expose-Headers", "MaxDataServiceVersion, DataServiceVersion");

    let body = JSON.stringify({
      "odata.metadata": "http://example.org/",
      "value": entityOrEntities,
    }, null, 2);
    httpResponseSender.sendHeader("Content-Type", "application/json;charset=utf-8");
    httpResponseSender.sendHeader("Content-Length", body.length.toString());

    httpResponseSender.sendBody(body);

    httpResponseSender.finishResponse();
  }
}

export class PostHandler<T> implements IPostHandler {

  constructor(private parser: odataParser.IPostRequestParser,
              private entityInitializer: entityReader.IEntityInitializer,
              private repository: IRepository<T>,
              private schema: Schema) {
  }

  public query(request: IHttpRequest, responseSender: IHttpResponseSender) {
    /* @todo verify AST */
    let parsed = this.parser.parse(request);
    let type = this.schema.getEntitySet(parsed.entitySetName).getEntityType();
    let entity = this.entityInitializer.fromParsed(parsed.entity, type);
    this.repository.batch(entity, this.schema, result => {
      responseSender.sendStatusCode(201, "Created");
      const insertedEntity = result.result()[result.result().length - 1].result().odata[0];
      responseSender.sendBody(JSON.stringify({
        "odata.metadata": "http://example.org/",
        "value": insertedEntity,
      }, null, 2));
      responseSender.finishResponse();
    });
  }
}

export class OptionsHandler implements IOptionsHandler {

  public query(request: IHttpRequest, responseSender: IHttpResponseSender) {
    responseSender.sendStatusCode(200);
    responseSender.sendHeader("Access-Control-Allow-Origin", "*");
    responseSender.sendHeader("Access-Control-Allow-Headers",
      "MaxDataServiceVersion, DataServiceVersion, Authorization, Accept, Authorization, odata-maxversion");
    responseSender.finishResponse();
  }
}
