import abnfTokenizer = require("abnfjs/tokenizer");
import abnfParser = require("abnfjs/parser");
import abnfInterpreter = require("abnfjs/interpreter");
import fs = require("fs");
import { IHttpRequest } from "./http";
import { EdmLiteral } from "./edm";
import {
  IValue, IAndExpressionVisitor, IOrExpressionVisitor, IEqExpressionVisitor,
  IStringLiteralVisitor, INumericLiteralVisitor, IParenthesesVisitor, IPropertyValueVisitor, IAnyExpressionVisitor,
  IStringLiteral, INumericLiteral, IEqExpression, IAndExpression, IOrExpression, IParentheses,
  IPropertyValue, IAnyExpression, ILambdaExpression,
} from "./filters/expressions";

declare let __dirname;

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

export type IParsedGetRequest<TFilterVisitor> = IParsedGetCollectionRequest<TFilterVisitor> | IParsedGetByIdRequest;

export interface IParsedGetCollectionRequest<TFilterVisitor> {
  type: GetRequestType.Collection;
  entitySetName: string;
  expandTree: any;
  filterExpression: IValue<TFilterVisitor> | undefined;
}

export interface IParsedGetByIdRequest {
  type: GetRequestType.ById;
  entitySetName: string;
  id: number;
}

export interface IODataParser {
  parse(query: string): any;
}

export enum GetRequestType {
  ById, Collection
}

export class PostRequestParser implements IPostRequestParser {

  private odataParser = new ODataParser();

  public parse(request: IHttpRequest): IParsedPostRequest {
    let ast = this.odataParser.parse(request.relativeUrl);
    return {
      entitySetName: ast.resourcePath.entitySetName,
      entity: this.parseBody(request.body),
    };
  }

  private parseBody(body: string) {
    const json = JSON.parse(body);
    const parsed: ParsedEntity = {};
    for (const key of Object.keys(json)) {
      const value = json[key];
      switch (typeof value) {
        case "string":
          parsed[key] = { type: "Edm.String", value: value };
          break;
        case "number":
          parsed[key] = { type: "Edm.Int32", value: value };
          break;
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
  IPropertyValueVisitor, IAnyExpressionVisitor {}

/* @todo make class more testable by injecting an IGetRequestParser for child expressions */
export class GetRequestParser implements IGetRequestParser<IFilterVisitor> {

  private odataParser = new ODataParser();

  public parse(request: IHttpRequest): IParsedGetRequest<IFilterVisitor> {
    const ast = this.odataParser.parse(request.relativeUrl);

    const entitySetName = ast.resourcePath.entitySetName;

    if (ast.resourcePath.navigation.type === "none") {
      const expandTree = {};
      (ast.queryOptions.expand || []).forEach(e => {
        let currentBranch = expandTree;
        e.path.forEach(prop => currentBranch = currentBranch[prop] = currentBranch[prop] || {});
      });
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
      let id: number;
      switch (rawId.type) {
        case "decimalValue": id = parseInt(rawId.value, 10); break;
        default: throw new Error(`Literal type ${rawId.type} is not supported as key predicate`);
      }
      return {
        type: GetRequestType.ById,
        entitySetName: entitySetName,
        id: id,
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
