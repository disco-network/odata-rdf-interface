import odataParser = require("../odata/parser");
import entityReader = require("../odata/entity_reader_base");
import { IRepository }  from "../odata/repository";
import { Schema } from "../odata/schema";
import { IHttpRequest, IHttpRequestHandler, IHttpResponseSender } from "../odata/http";

export interface IGetHandler extends IHttpRequestHandler {
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
              private parser: odataParser.IGetRequestParser, private repository: IRepository) {}

  public query(request: IHttpRequest, responseSender: IHttpResponseSender) {
    let parsed = this.parser.parse(request);
    let type = this.schema.getEntitySet(parsed.entitySetName).getEntityType();
    this.repository.getEntities(type, parsed.expandTree, parsed.filterTree, result => {
      responseSender.sendBody(JSON.stringify(result.result()));
      responseSender.finishResponse();
    });
  }
}

export class PostHandler implements IPostHandler {

  private schema: Schema;

  constructor(private parser: odataParser.IPostRequestParser,
              private entityInitializer: entityReader.IEntityInitializer,
              private repository: IRepository) {
  }

  public query(request: IHttpRequest, responseSender: IHttpResponseSender) {
    /* @todo verify AST */
    let parsed = this.parser.parse(request);
    let type = this.schema.getEntitySet(parsed.entitySetName).getEntityType();
    let entity = this.entityInitializer.fromParsed(parsed.entity, type);
    this.repository.insertEntity(entity, type, result => {
      responseSender.sendBody(result.toString());
      responseSender.finishResponse();
    });
  }

  public setSchema(schm: Schema) {
    this.schema = schm;
  }
}

export class OptionsHandler implements IOptionsHandler {

  public query(request: IHttpRequest, responseSender: IHttpResponseSender) {
    responseSender.sendHeader("Access-Control-Allow-Origin", "*");
    responseSender.sendHeader("Access-Control-Allow-Headers",
      "MaxDataServiceVersion, DataServiceVersion, Authorization, Accept, Authorization, odata-maxversion");
    responseSender.finishResponse();
  }
}
