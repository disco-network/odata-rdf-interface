import odataParser = require("../odata/parser");
import entityReader = require("../odata/entity_reader_base");
import { IRepository }  from "../odata/repository";
import { Schema } from "../odata/schema";
import { IHttpRequest, IHttpRequestHandler, IHttpResponseSender } from "../odata/http";

export interface IGetHandler extends IHttpRequestHandler {
}

export interface IGetResponseSender {
  success(entities: any[]): void;
}

export interface IPostHandler extends IHttpRequestHandler {
}

export interface IOptionsHandler extends IHttpRequestHandler {
}

export interface IPostRequestResult {
  success: boolean;
}

export class GetHandler implements IGetHandler {

  constructor(private schema: Schema,
              private parser: odataParser.IGetRequestParser,
              private repository: IRepository,
              private responseSender: IGetResponseSender) {}

  public query(request: IHttpRequest) {
    let parsed = this.parser.parse(request);
    let type = this.schema.getEntitySet(parsed.entitySetName).getEntityType();
    this.repository.getEntities(type, parsed.expandTree, parsed.filterTree, result => {
      this.responseSender.success(result.result());
    });
  }
}

export class GetResponseSender implements IGetResponseSender {

  constructor(private httpResponseSender: IHttpResponseSender) {}

  public success(entities: any[]) {
    this.httpResponseSender.sendStatusCode(200);

    this.httpResponseSender.sendHeader("Access-Control-Allow-Origin", "*");
    this.httpResponseSender.sendHeader("Access-Control-Expose-Headers", "MaxDataServiceVersion, DataServiceVersion");

    let body = JSON.stringify({
      "odata.metadata": "http://example.org/",
      "value": entities,
    }, null, 2);
    this.httpResponseSender.sendHeader("Content-Type", "application/json;charset=utf-8");
    this.httpResponseSender.sendHeader("Content-Length", body.length.toString());

    this.httpResponseSender.sendBody(body);

    this.httpResponseSender.finishResponse();
  }
}

export class PostHandler implements IPostHandler {

  private schema: Schema;

  constructor(private parser: odataParser.IPostRequestParser,
              private entityInitializer: entityReader.IEntityInitializer,
              private repository: IRepository,
              private responseSender: IHttpResponseSender) {
  }

  public query(request: IHttpRequest) {
    /* @todo verify AST */
    let parsed = this.parser.parse(request);
    let type = this.schema.getEntitySet(parsed.entitySetName).getEntityType();
    let entity = this.entityInitializer.fromParsed(parsed.entity, type);
    this.repository.insertEntity(entity, type, result => {
      this.responseSender.sendBody(result.toString());
      this.responseSender.finishResponse();
    });
  }

  public setSchema(schm: Schema) {
    this.schema = schm;
  }
}

export class OptionsHandler implements IOptionsHandler {

  constructor(private responseSender: IHttpResponseSender) {}

  public query(request: IHttpRequest) {
    this.responseSender.sendHeader("Access-Control-Allow-Origin", "*");
    this.responseSender.sendHeader("Access-Control-Allow-Headers",
      "MaxDataServiceVersion, DataServiceVersion, Authorization, Accept, Authorization, odata-maxversion");
    this.responseSender.finishResponse();
  }
}
