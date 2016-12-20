import abnfTokenizer = require("abnfjs/tokenizer");
import abnfParser = require("abnfjs/parser");
import abnfInterpreter = require("abnfjs/interpreter");
import fs = require("fs");
import { IHttpRequest } from "./http";
import { EdmLiteral } from "./edm";
import {
  IValue, IAndExpressionVisitor, IOrExpressionVisitor, IEqExpressionVisitor,
  IStringLiteralVisitor, INumericLiteralVisitor, INullVisitor,
  IParenthesesVisitor, IPropertyValueVisitor, IAnyExpressionVisitor,
  IStringLiteral, INumericLiteral, INull,
  IEqExpression, IAndExpression, IOrExpression, IParentheses,
  IPropertyValue, IAnyExpression, ILambdaExpression,
} from "./filters/expressions";

declare let __dirname;

export interface IPatchRequestParser {
  parse(request: IHttpRequest): IParsedPatchRequest;
}

export interface IParsedPatchRequest {
  entitySetName: string;
  id: EdmLiteral;
  entity: ParsedEntity;
}

export interface IPostRequestParser {
  parse(request: IHttpRequest): IParsedPostRequest;
}

export interface IParsedPostRequest {
  entitySetName: string;
  entity: ParsedEntity;
}

export interface IGetRequestParser<TFilterVisitor> {
  parse(request: IHttpRequest): IParsedGetRequest<TFilterVisitor>;
}

export type IParsedGetRequest<TFilterVisitor>
= IParsedGetCollectionRequest<TFilterVisitor> | IParsedGetByIdRequest | IParsedPropertyOfSingleRequest;

export interface IParsedGetCollectionRequest<TFilterVisitor> {
  type: GetRequestType.Collection;
  entitySetName: string;
  expandTree: any;
  filterExpression: IValue<TFilterVisitor> | undefined;
}

export interface IParsedGetByIdRequest {
  type: GetRequestType.ById;
  entitySetName: string;
  id: EdmLiteral;
}

export interface IParsedPropertyOfSingleRequest {
  type: GetRequestType.PropertyOfSingle;
  entitySetName: string;
  id: EdmLiteral;
  propertyName: string;
}

export interface IODataParser {
  parse(query: string): any;
}

export enum GetRequestType {
  ById, PropertyOfSingle, Collection
}

export class PatchRequestParser implements IPatchRequestParser {

  private odataParser = new ODataParser();
  private literalParser = new LiteralParser();

  public parse(request: IHttpRequest): IParsedPatchRequest {
    const ast = this.odataParser.parse(request.relativeUrl);
    if (ast.resourcePath.navigation.type !== "collection-navigation")
      throw new Error("PATCH request requires a key predicate");
    const id = this.literalParser.parse(ast.resourcePath.navigation.path.keyPredicate.simpleKey);
    return {
      entitySetName: ast.resourcePath.entitySetName,
      id: id,
      entity: new BodyParser().parse(request),
    };
  }
}

export class PostRequestParser implements IPostRequestParser {

  private odataParser = new ODataParser();

  public parse(request: IHttpRequest): IParsedPostRequest {
    let ast = this.odataParser.parse(request.relativeUrl);
    return {
      entitySetName: ast.resourcePath.entitySetName,
      entity: new BodyParser().parse(request),
    };
  }
}

export class BodyParser {
  public parse(request: IHttpRequest): ParsedEntity {
    const json = JSON.parse(request.body);
    const parsed: ParsedEntity = {};
    for (const key of Object.keys(json)) {
      const value = json[key];
      switch (typeof value) {
        case "string":
          parsed[key] = { type: "Edm.String", value: value as string };
          break;
        case "number":
          parsed[key] = { type: "Edm.Int32", value: value as number };
          break;
        case "object":
          if (value === null) {
            parsed[key] = { type: "null" };
            break;
          };
        default:
          throw new Error("unsupported value for property");
      }
    }
    return parsed;
  }
}

export interface ParsedEntity {
  [id: string]: EdmLiteral;
}

export interface IFilterVisitor extends IStringLiteralVisitor, INumericLiteralVisitor,
  IAndExpressionVisitor, IOrExpressionVisitor, IEqExpressionVisitor, IParenthesesVisitor,
  IPropertyValueVisitor, IAnyExpressionVisitor, INullVisitor {}

/* @todo make class more testable by injecting an IGetRequestParser for child expressions */
export class GetRequestParser implements IGetRequestParser<IFilterVisitor> {

  private odataParser = new ODataParser();
  private literalParser = new LiteralParser();

  public parse(request: IHttpRequest): IParsedGetRequest<IFilterVisitor> {
    const ast = this.odataParser.parse(request.relativeUrl);

    const entitySetName = ast.resourcePath.entitySetName;

    if (ast.resourcePath.navigation.type === "none") {
      const expandTree = ast.queryOptions.expand || {};
      const filterTree = ast.queryOptions.filter ? this.parseFilterExpression(ast.queryOptions.filter) : undefined;
      return {
        type: GetRequestType.Collection,
        entitySetName: entitySetName,
        expandTree: expandTree,
        filterExpression: filterTree,
      };
    }
    else if (ast.resourcePath.navigation.type === "collection-navigation") {
      const rawId = ast.resourcePath.navigation.path.keyPredicate.simpleKey;
      const singleNavigation = ast.resourcePath.navigation.path.singleNavigation;

      if (singleNavigation !== undefined) return {
        type: GetRequestType.PropertyOfSingle,
        entitySetName: entitySetName,
        id: this.literalParser.parse(rawId),
        propertyName: singleNavigation.propertyPath.propertyName,
      };

      else return {
        type: GetRequestType.ById,
        entitySetName: entitySetName,
        id: this.literalParser.parse(rawId),
      };
    }
    else throw new Error("unknown collection navigation type");
  }

  public parseFilterExpression(raw): IValue<IFilterVisitor> {
    switch (raw.type) {
      case "operator":
        return this.parseFilterOperation(raw);
      case "member-expression":
        return this.parseMemberExpression(raw);
      case "string":
        return new StringLiteral(raw.value.toString());
      case "decimalValue":
        return new NumericLiteral(parseInt(raw.value, 10));
      case "null":
        return new Null();
      case "parentheses-expression":
        return new ParenthesesExpression(this.parseFilterExpression(raw.inner));
      default:
        throw new Error("Unsupported filter expression");
    }
  }

  public parseFilterOperation(raw): IValue<IFilterVisitor> {
    const lhs = this.parseFilterExpression(raw.lhs);
    const rhs = this.parseFilterExpression(raw.rhs);
    switch (raw.op) {
      case "eq":
        return new EqExpression(lhs, rhs);
      case "and":
        return new AndExpression(lhs, rhs);
      case "or":
        return new OrExpression(lhs, rhs);
      default:
        throw new Error("Unsupported filter operator");
    }
  }

  public parseMemberExpression(raw): IValue<IFilterVisitor> {
    switch (raw.operation) {
      case "property-value":
        return new PropertyValue(raw.path);
      case "any":
        return new AnyExpression<IFilterVisitor>(raw.path, raw.lambdaExpression.variable,
                                 this.parseFilterExpression(raw.lambdaExpression.predicateExpression));
      default:
        throw new Error("Unsupported member expression");
    }
  }

  private mergeTree(into, from) {
    for (const key of Object.keys(from)) {
      into[key] = into[key] || {};
      this.mergeTree(into[key], from[key]);
    }
  }
}

export class LiteralParser {
  public parse(rawId): EdmLiteral {
      switch (rawId.type) {
        case "decimalValue":
          /* @todo throw when NaN */
          return { type: "Edm.Int32", value: parseInt(rawId.value, 10) };
        case "string":
          return { type: "Edm.String", value: rawId.value };
        default:
          throw new Error(`${rawId.type} is not a supported type for a key.`);
      }
  }
}

export class ODataParser implements IODataParser {

  private interpreter: abnfInterpreter.Interpreter;

  constructor() {
    let abnf = fs.readFileSync(__dirname + "/config/odata4-mod.abnf", "utf8");
    let tokens = new abnfTokenizer.tokenize(abnf);
    let grammar = new abnfParser.parse(tokens);
    this.interpreter = new abnfInterpreter.Interpreter(grammar);
  }

  public parse(query: string): any {
    query = query.substr(1); // remove "/"
    return this.interpreter
      .getCompleteMatch(this.interpreter.getPattern("odataRelativeUri"), query)
      .evaluate();
  }
}

export class StringLiteral implements IStringLiteral<IStringLiteralVisitor> {

  constructor(private value: string) {}

  public getString(): string {
    return this.value;
  }

  public accept(visitor: IStringLiteralVisitor) {
    visitor.visitStringLiteral(this);
  }
}

export class NumericLiteral implements INumericLiteral<INumericLiteralVisitor> {

  constructor(private value: number) {}

  public getNumber(): number {
    return this.value;
  }

  public accept(visitor: INumericLiteralVisitor) {
    visitor.visitNumericLiteral(this);
  }
}

export class Null implements INull<INullVisitor> {
  public accept(visitor: INullVisitor) {
    visitor.visitNull(this);
  }
}

export class BinaryExpression<T> {

  constructor(private lhs: IValue<T>, private rhs: IValue<T>) {}

  public getLhs() {
    return this.lhs;
  }

  public getRhs() {
    return this.rhs;
  }
}

export class EqExpression<T extends IEqExpressionVisitor> extends BinaryExpression<T> implements IEqExpression<T> {
  public accept(visitor: T) {
    visitor.visitEqExpression(this);
  }
}

export class AndExpression<T extends IAndExpressionVisitor> extends BinaryExpression<T> implements IAndExpression<T> {
  public accept(visitor: T) {
    visitor.visitAndExpression(this);
  }
}

export class OrExpression<T extends IOrExpressionVisitor> extends BinaryExpression<T> implements IOrExpression<T> {
  public accept(visitor: T) {
    visitor.visitOrExpression(this);
  }
}

export class ParenthesesExpression<T extends IParenthesesVisitor> implements IParentheses<T> {

  constructor(private inner: IValue<T>) {}

  public accept(visitor: T) {
    visitor.visitParentheses(this);
  }

  public getInner(): IValue<T> {
    return this.inner;
  }
}

export class PropertyValue implements IPropertyValue<IPropertyValueVisitor> {

  constructor(private path: string[]) {}

  public accept(visitor: IPropertyValueVisitor) {
    visitor.visitPropertyValue(this);
  }

  public getPropertyPath(): string[] {
    return this.path;
  }
}

class AnyExpression<T extends IAnyExpressionVisitor> implements IAnyExpression<T> {

  constructor(private path: string[], private variable: string, private lambda: IValue<T>) {}

  public accept(visitor: T) {
    visitor.visitAnyExpression(this);
  }

  public getPropertyPath(): string[] {
    return this.path;
  }

  public getLambdaExpression(): ILambdaExpression<T> {
    return {
      variable: this.variable,
      expression: this.lambda,
    };
  }
}
