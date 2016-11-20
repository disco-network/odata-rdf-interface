import {
  IGetRequestParser, IPostRequestParser, IPatchRequestParser,
  GetRequestType, EqExpression, PropertyValue, NumericLiteral,
} from "../odata/parser";
import { IEqExpressionVisitor, IPropertyValueVisitor, INumericLiteralVisitor } from "../odata/filters/expressions";
import entityInitializer = require("../odata/entityinitializer_base");
import { BadBodyError } from "../odata/entityinitializer";
import { IRepository } from "../odata/repository";
import { Schema } from "../odata/schema";
import { EdmConverter, EdmLiteral } from "../odata/edm";
import { IHttpRequest, IHttpRequestHandler, IHttpResponseSender } from "../odata/http";

export interface IGetHandler extends IHttpRequestHandler {
}

export interface IGetHttpResponder {
  success(entityOrEntities: any, responseSender: IHttpResponseSender): void;
}

export interface IPostHandler extends IHttpRequestHandler {
}

export interface IPatchHandler extends IHttpRequestHandler {
}

export interface IOptionsHandler extends IHttpRequestHandler {
}

export interface IPostRequestResult {
  success: boolean;
}

export interface IMinimalVisitor extends INumericLiteralVisitor, IEqExpressionVisitor, IPropertyValueVisitor { }
export class GetHandler<T extends IMinimalVisitor> implements IGetHandler {
  private edmConverter = new EdmConverter(); /* @todo move */

  constructor(
    private schema: Schema,
    private parser: IGetRequestParser<T>,
    private repository: IRepository<T>,
    private getHttpResponder: IGetHttpResponder) { }

  public query(request: IHttpRequest, httpResponseSender: IHttpResponseSender) {
    let parsed = this.parser.parse(request);
    const type = this.schema.getEntitySet(parsed.entitySetName).getEntityType();
    switch (parsed.type) {
      case GetRequestType.Collection:
        this.repository.getEntities(type, parsed.expandTree, parsed.filterExpression, result => {
          if (result.success()) {
            this.getHttpResponder.success(result.result(), httpResponseSender);
          } else {
            httpResponseSender.sendBody(result.error().stack);
            httpResponseSender.sendStatusCode(500);
            httpResponseSender.finishResponse();
          }
        });
        break;
      case GetRequestType.ById:
        const edmLiteral = this.edmConverter.convert(parsed.id, type.getProperty("Id").getEntityType().getName());
        this.repository.getEntities(type, {}, this.filterExpressionFromEntityId(edmLiteral), result => {
          if (result.success())
            this.getHttpResponder.success(result.result()[0], httpResponseSender);
        });
        break;
      case GetRequestType.PropertyOfSingle:
        const req = parsed;
        const baseEntityId = this.edmConverter.convert(parsed.id, type.getProperty("Id").getEntityType().getName());

        this.repository.getEntities(type, { [req.propertyName]: {} },
          this.filterExpressionFromEntityId(baseEntityId), result => {

            if (result.success()) {
              this.getHttpResponder.success(result.result()[0][req.propertyName], httpResponseSender);
            }
          });
        break;
      default:
        throw new Error("This GetRequestType is not supported.");
    }
  }

  private filterExpressionFromEntityId(id: EdmLiteral) {
    const propertyExpr = new PropertyValue(["Id"]);
    let literal: NumericLiteral;
    switch (id.type) {
      case "Edm.Int32":
        literal = new NumericLiteral(id.value);
        break;
      default:
        throw new Error(`This type is not supported as key.`);
    }
    return new EqExpression<T>(propertyExpr, literal);
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

  constructor(
    private parser: IPostRequestParser,
    private entityInitializer: entityInitializer.IEntityInitializer,
    private repository: IRepository<T>,
    private schema: Schema) {
  }

  public query(request: IHttpRequest, responseSender: IHttpResponseSender) {
    /* @todo verify AST */
    const parsed = this.parser.parse(request);
    const type = this.schema.getEntitySet(parsed.entitySetName).getEntityType();
    try {
      const entity = this.entityInitializer.insertionFromParsed(parsed.entity, type);
      this.repository.batch(entity, this.schema, result => {
        responseSender.sendStatusCode(201, "Created");
        const insertion = result.result()[result.result().length - 1];
        if (insertion.success() === false) {
          throw new Error(insertion.error());
        }
        const insertedEntity = insertion.result().odata[0];
        responseSender.sendBody(JSON.stringify({
          "odata.metadata": "http://example.org/",
          "value": insertedEntity,
        }, null, 2));
        responseSender.finishResponse();
      });
    }
    catch (e) {
      if (e instanceof BadBodyError) {
        responseSender.sendStatusCode(400, "Bad Request");
        responseSender.finishResponse();
      }
      else throw e;
    }
  }
}

export class PatchHandler<T> implements IPatchHandler {

  constructor(
    private parser: IPatchRequestParser, private schema: Schema,
    private entityInitializer: entityInitializer.IEntityInitializer,
    private repository: IRepository<T>) { }

  public query(request: IHttpRequest, responseSender: IHttpResponseSender) {
    const parsed = this.parser.parse(request);
    const type = this.schema.getEntitySet(parsed.entitySetName).getEntityType();

    const batch = this.entityInitializer.patchFromParsed(parsed.entity, type, { Id: parsed.id });
    this.repository.batch(batch, this.schema, answer => {
      answer.process(
        result => {
          responseSender.sendStatusCode(201, "No Content");
          responseSender.finishResponse();
        },
        err => {
          responseSender.sendStatusCode(500, "Internal Server Error");
          responseSender.finishResponse();
        }
      );
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
