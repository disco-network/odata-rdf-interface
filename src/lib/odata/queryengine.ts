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
import { ILogger } from "../logger";

declare var process;

export interface IGetHandler extends IHttpRequestHandler {
}

export interface IGetHttpResponder {
  arrayResult(entities: any[], responseSender: IHttpResponseSender): void;
  singleEntityResult(entity: any, responseSender: IHttpResponseSender): void;
  error(message: string, responseSender: IHttpResponseSender): void;
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
    private getHttpResponder: IGetHttpResponder,
    private logger?: ILogger) { }

  public query(request: IHttpRequest, httpResponseSender: IHttpResponseSender) {
    let parsed = this.parser.parse(request);
    const type = this.schema.getEntitySet(parsed.entitySetName).getEntityType();
    switch (parsed.type) {
      case GetRequestType.Collection:
        const timeBeforeQuery = process.hrtime();
        if (this.logger !== undefined) {
          this.logger.debug(`Let's do a collection query!`);
        }
        this.repository.getEntities(type, parsed.expandTree, parsed.filterExpression, result => {
          if (this.logger !== undefined) {
            const finishedAfterTime = process.hrtime(timeBeforeQuery);
            this.logger.debug(
              `Query finished after [${finishedAfterTime[0] + finishedAfterTime[1] / 1000000}ms]`);
          }
          if (result.success()) {
            this.getHttpResponder.arrayResult(result.result(), httpResponseSender);
          } else {
            this.getHttpResponder.error(result.error().stack, httpResponseSender);
          }
        });
        break;
      case GetRequestType.ById:
        const edmLiteral = this.edmConverter.convert(parsed.id, type.getProperty("Id").getEntityType().getName());
        this.repository.getEntities(type, {}, this.filterExpressionFromEntityId(edmLiteral), result => {
          if (result.success()) {
            this.getHttpResponder.singleEntityResult(result.result()[0], httpResponseSender);
          } else {
            this.getHttpResponder.error(result.error().stack, httpResponseSender);
          }
        });
        break;
      case GetRequestType.PropertyOfSingle:
        const req = parsed;
        const baseEntityId = this.edmConverter.convert(parsed.id, type.getProperty("Id").getEntityType().getName());

        this.repository.getEntities(type, { [req.propertyName]: {} },
          this.filterExpressionFromEntityId(baseEntityId), result => {

            if (result.success()) {
              const isNotArray = type.getProperty(req.propertyName).isMultiplicityOne();

              if (isNotArray)
                this.getHttpResponder.singleEntityResult(result.result()[0][req.propertyName], httpResponseSender);
              else
                this.getHttpResponder.arrayResult(result.result()[0][req.propertyName], httpResponseSender);
            } else {
              this.getHttpResponder.error(result.error().stack, httpResponseSender);
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

  public arrayResult(entities: any[], httpResponseSender: IHttpResponseSender) {
    this.success({
      "odata.metadata": "http://example.org/",
      "value": entities,
    }, httpResponseSender);
  }

  public singleEntityResult(entity: any, httpResponseSender: IHttpResponseSender) {
    const data = {};
    Object.keys(entity).forEach(k => data[k] = entity[k]);
    data["odata.metadata"] = "http://example.org/";

    this.success(data, httpResponseSender);
  }

  public error(message: string, httpResponseSender: IHttpResponseSender): void {
    httpResponseSender.sendBody(message);
    httpResponseSender.sendStatusCode(500);
    httpResponseSender.finishResponse();
  }

  private success(data: any, httpResponseSender: IHttpResponseSender) {
    httpResponseSender.sendStatusCode(200);

    httpResponseSender.sendHeader("Access-Control-Allow-Origin", "*");
    httpResponseSender.sendHeader("Access-Control-Expose-Headers", "MaxDataServiceVersion, DataServiceVersion");

    let body = JSON.stringify(data, null, 2);
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
        const data = {};
        Object.keys(insertedEntity).forEach(k => data[k] = insertedEntity[k]);
        data["odata.metadata"] = "http://example.org/";
        responseSender.sendBody(JSON.stringify(data, null, 2));
        responseSender.finishResponse();
      });
    }
    catch (e) {
      if (e instanceof BadBodyError) {
        responseSender.sendStatusCode(400, "Bad Request");
        responseSender.finishResponse();
      }
      else {
        throw e;
      }
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
