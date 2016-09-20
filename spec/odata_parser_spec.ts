import { assert } from "chai";
import { stub } from "sinon";

import {
  IPostRequestParser, PostRequestParser, GetRequestParser,
  IODataParser, ODataParser, IFilterVisitor
} from "../src/odata/parser";
import queryTestCases = require("./helpers/querytestcases");

describe("ODataParser @todo inject this dependency @todo create abstraction", function() {
  it("should parse an OData filter expression", function() {
    let parser = initODataParser();
    let evaluated = parser.parse("Posts?$filter=a/b/c eq 1");

    assert.isDefined(evaluated.queryOptions);
    assert.isDefined(evaluated.queryOptions.filter);
    assert.strictEqual(evaluated.queryOptions.filter.type, "operator");
    assert.strictEqual(evaluated.queryOptions.filter.lhs.type, "member-expression");
    assert.strictEqual(evaluated.queryOptions.filter.rhs.type, "decimalValue");
  });

  it("should parse an OData expand expression", function() {
    let parser = initODataParser();
    let result = parser.parse("Posts?$expand=Children/ReferredFrom");

    assert.strictEqual(result.queryOptions.expand.length, 1);
    assert.strictEqual(result.queryOptions.expand[0].path[0], "Children");
    assert.strictEqual(result.queryOptions.expand[0].path[1], "ReferredFrom");
  });

  it("should parse a string with \"", () => {
    let parser = initODataParser();
    let result = parser.parse("Posts?$filter='''' eq ''");

    assert.strictEqual(result.queryOptions.filter.lhs.value, "'");
  });

  it("should parse a simple filter expression", () => {
    let parser = initODataParser();
    let result = parser.parse("Posts?$filter='2' eq '1'");

    let filterOption = result.queryOptions.filter;
    assert.strictEqual(filterOption.type, "operator");
    assert.strictEqual(filterOption.op, "eq");
    assert.strictEqual(filterOption.rhs.type, "string");
    assert.strictEqual(filterOption.rhs.value, "1");
  });

  it("should parse a simple member expression", () => {
    let parser = initODataParser();
    let result = parser.parse("Posts?$filter=Id eq '1'");

    let filterOption = result.queryOptions.filter;
    assert.strictEqual(filterOption.lhs.type, "member-expression");
    assert.strictEqual(filterOption.lhs.path.length, 1);
    assert.strictEqual(filterOption.lhs.path[0], "Id");
    assert.strictEqual(filterOption.lhs.operation, "property-value");
  });

  it("should parse a simple any expression", () => {
    let parser = initODataParser();
    let result = parser.parse("Posts?$filter=Children/any(it: it/Id eq 2)");

    let filterOption = result.queryOptions.filter;
    assert.strictEqual(filterOption.type, "member-expression");
    assert.strictEqual(filterOption.operation, "any");
    assert.deepEqual(filterOption.path, ["Children"]);
    assert.strictEqual(filterOption.lambdaExpression.variable, "it");
    assert.strictEqual(filterOption.lambdaExpression.predicateExpression.type, "operator");
  });

  it("should accept parentheses in a filter expression", () => {
    let parser = initODataParser();
    let result = parser.parse("Posts?$filter=(Id eq '1')");

    let filterOption = result.queryOptions.filter;
    assert.strictEqual(filterOption.type, "parentheses-expression");
    assert.strictEqual(filterOption.inner.type, "operator");
  });
});

describe("PostRequestParser (generated tests)", () => {
  queryTestCases.odataParserTests.forEach(
    (args, i) => spec(`#${i}`, args)
  );

  function spec(name: string, args: queryTestCases.IPostRequestParserTestCase) {
    it(name, () => {
      let parser = initPostRequestParser();

      let parsed = parser.parse({ relativeUrl: args.query, body: args.body });

      assert.strictEqual(parsed.entitySetName, args.entitySetName);
    });
  }
});

describe("PostRequestParser:", () => {
  it("should parse the JSON body", () => {
    let parser = initPostRequestParser();

    let parsed = parser.parse({ relativeUrl: "/Posts", body: "{ \"ContentId\": \"1\" }" });

    assert.deepEqual(parsed.entity, { ContentId: "1" });
  });
});

/* @construction body spec */

describe("GetRequestParser:", () => {
  it("should also return the correct entity set name", () => {
    let parser = initGetRequestParser();

    let parsed = parser.parse({ relativeUrl: "/Posts", body: "" });

    assert.strictEqual(parsed.entitySetName, "Posts");
  });

  it("should also return the filter tree", done => {
    const parser = initGetRequestParser();

    const eqVisitor: IFilterVisitor = new Visitor();
    eqVisitor.visitEqExpression = expr => {
      expr.getLhs().accept(propertyVisitor);
    };
    const propertyVisitor: IFilterVisitor = new Visitor();
    propertyVisitor.visitPropertyValue = expr => {
      assert.deepEqual(expr.getPropertyPath(), ["a", "b", "c"]);
      done();
    };

    const parsed = parser.parse({ relativeUrl: "/Posts?$filter=a/b/c eq 1", body: "" });
    parsed.filterExpression.accept(eqVisitor);
  });

  it("should also return the expand tree", () => {
    let parser = initGetRequestParser();

    let parsed = parser.parse({ relativeUrl: "/Posts?$expand=Children", body: "" });

    assert.deepEqual(parsed.expandTree, { Children: {} });
  });
});

function initPostRequestParser(): IPostRequestParser {
  return new PostRequestParser();
}

function initGetRequestParser() {
  return new GetRequestParser();
}

function initODataParser(): IODataParser {
  return new ODataParser();
}

class Visitor implements IFilterVisitor {
  public visitStringLiteral() {}
  public visitNumericLiteral() {}
  public visitAndExpression() {}
  public visitOrExpression() {}
  public visitEqExpression() {}
  public visitParentheses() {}
  public visitPropertyValue() {}
  public visitAnyExpression() {}
}
