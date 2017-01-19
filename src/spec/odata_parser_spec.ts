import { assert, assertEx, match } from "../lib/assert";

import {
  IPostRequestParser, PostRequestParser, GetRequestParser, GetRequestType,
  PatchRequestParser,
  IODataParser, ODataParser, IFilterVisitor,
} from "../lib/odata/parser";
import queryTestCases = require("./helpers/querytestcases");

describe("ODataParser @todo inject this dependency @todo create abstraction", function() {
  it("should parse GET /:set(:id)", () => {
    const parsed = initODataParser().parse("/Posts(1)");

    assert.deepEqual(parsed, {
      type: "resourceQuery",
      queryOptions: {},
      resourcePath: {
        type: "entitySet",
        entitySetName: "Posts",
        navigation: {
          type: "collection-navigation",
          path: {
            type: "collection-navigation",
            singleNavigation: undefined,
            keyPredicate: {
              simpleKey: {
                type: "decimalValue",
                value: "1",
              },
            },
          },
        },
      },
    });
  });

  it("should parse a parentheses expression", function () {
    const parser = initODataParser();
    parser.parse("/Posts?$filter=(1 eq 1)");
  });

  it("should parse an OData filter expression", function() {
    const parser = initODataParser();
    const evaluated = parser.parse("/Posts?$filter=a/b/c eq 1");

    assert.isDefined(evaluated.queryOptions);
    assert.isDefined(evaluated.queryOptions.filter);
    assert.strictEqual(evaluated.queryOptions.filter.type, "operator");
    assert.strictEqual(evaluated.queryOptions.filter.lhs.type, "member-expression");
    assert.strictEqual(evaluated.queryOptions.filter.rhs.type, "decimalValue");
  });

  it("should parse a NotEquals expression", function() {
    const parser = initODataParser();
    const result = parser.parse("/Posts?$filter=1 ne 2");

    assert.strictEqual(result.queryOptions.filter.type, "operator");
  });

  it("should parse an OData expand expression", function() {
    let parser = initODataParser();
    let result = parser.parse("/Posts?$expand=Children/ReferredFrom");

    assert.deepEqual(result.queryOptions.expand, { Children: { ReferredFrom: {} } });
  });

  it("should parse nested expand expressions (OData v4)", function() {
    // @todo hacked solution, $expand=A($filter=Id eq 1) is still impossible
    const parser = initODataParser();
    const result = parser.parse("/Posts?$expand=Children/Children($expand=ReferredFrom)");

    assert.deepEqual(result.queryOptions.expand, { Children: { Children: { ReferredFrom: {} } } });
  });

  it("should parse a string with \"", () => {
    let parser = initODataParser();
    let result = parser.parse("/Posts?$filter='''' eq ''");

    assert.strictEqual(result.queryOptions.filter.lhs.value, "'");
  });

  it("should parse a simple filter expression", () => {
    let parser = initODataParser();
    let result = parser.parse("/Posts?$filter='2' eq '1'");

    let filterOption = result.queryOptions.filter;
    assert.strictEqual(filterOption.type, "operator");
    assert.strictEqual(filterOption.op, "eq");
    assert.strictEqual(filterOption.rhs.type, "string");
    assert.strictEqual(filterOption.rhs.value, "1");
  });

  it("should parse a simple member expression", () => {
    let parser = initODataParser();
    let result = parser.parse("/Posts?$filter=Id eq '1'");

    let filterOption = result.queryOptions.filter;
    assert.strictEqual(filterOption.lhs.type, "member-expression");
    assert.strictEqual(filterOption.lhs.path.length, 1);
    assert.strictEqual(filterOption.lhs.path[0], "Id");
    assert.strictEqual(filterOption.lhs.operation, "property-value");
  });

  it("should parse a simple any expression", () => {
    let parser = initODataParser();
    let result = parser.parse("/Posts?$filter=Children/any(it: it/Id eq 2)");

    let filterOption = result.queryOptions.filter;
    assert.strictEqual(filterOption.type, "member-expression");
    assert.strictEqual(filterOption.operation, "any");
    assert.deepEqual(filterOption.path, ["Children"]);
    assert.strictEqual(filterOption.lambdaExpression.variable, "it");
    assert.strictEqual(filterOption.lambdaExpression.predicateExpression.type, "operator");
  });

  it("should accept parentheses in a filter expression", () => {
    let parser = initODataParser();
    let result = parser.parse("/Posts?$filter=(Id eq '1')");

    let filterOption = result.queryOptions.filter;
    assert.strictEqual(filterOption.type, "parentheses-expression");
    assert.strictEqual(filterOption.inner.type, "operator");
  });

  it("should parse 'null' in $filter expressions", () => {
    const parsed = initODataParser().parse("/Posts?$filter=ParentId eq null");
    const filter = parsed.queryOptions.filter;

    assertEx.deepEqual(filter, {
      type: "operator",
      op: "eq",
      lhs: match.any,
      rhs: { type: "null" },
    });
  });
});

describe("OData.PatchRequestParser:", () => {
  it ("should parse the URI /Content('Yiehaa')", () => {
    const parser = initPatchRequestParser();
    const parsed = parser.parse({ relativeUrl: "/Content('Yiehaa')", body: `{ "Title": "[Title]" }` });
    assert.deepEqual(parsed, {
      entitySetName: "Content",
      id: { type: "Edm.String", value: "Yiehaa" },
      entity: {
        Title: { type: "Edm.String", value: "[Title]" },
      },
    });
  });

  it ("should parse the URI /Content(42)", () => {
    const parser = initPatchRequestParser();
    const parsed = parser.parse({ relativeUrl: "/Content(42)", body: `{ "Title": "[Title]" }` });
    assert.deepEqual(parsed, {
      entitySetName: "Content",
      id: { type: "Edm.Int32", value: 42 },
      entity: {
        Title: { type: "Edm.String", value: "[Title]" },
      },
    });
  });
});

describe("OData.PostRequestParser (generated tests)", () => {
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

describe("OData.PostRequestParser:", () => {
  it("should parse string properties as { type: 'Edm.String', value: ... }", () => {
    const parsed = initPostRequestParser().parse({
      relativeUrl: "/Entities", body: `{ "String": "Lorem ipsum" }`,
    });

    assert.deepEqual(parsed.entity, { String: { type: "Edm.String", value: "Lorem ipsum" } });
  });

  it("should parse string properties as { type: 'Edm.Int32', value: ... }", () => {
    const parsed = initPostRequestParser().parse({
      relativeUrl: "/Entities", body: `{ "Int32": 42 }`,
    });

    assert.deepEqual(parsed.entity, { Int32: { type: "Edm.Int32", value: 42 } });
  });
});

describe("OData.GetRequestParser:", () => {
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
    assert.strictEqual(GetRequestType[parsed.type], GetRequestType[GetRequestType.Collection]);
    if (parsed.type === GetRequestType.Collection)
      parsed.filterExpression!.accept(eqVisitor);
  });

  it("should also return the expand tree", () => {
    let parser = initGetRequestParser();

    let parsed = parser.parse({ relativeUrl: "/Posts?$expand=Children", body: "" });

    assert.strictEqual(GetRequestType[parsed.type], GetRequestType[GetRequestType.Collection]);
    if (parsed.type === GetRequestType.Collection)
      assert.deepEqual(parsed.expandTree, { Children: {} });
  });

  it("should parse /:set(:id)", () => {
    const parser = initGetRequestParser();
    const parsed = parser.parse({ relativeUrl: "/Posts(1)", body: "" });

    assert.strictEqual(GetRequestType[parsed.type], GetRequestType[GetRequestType.ById]);
    if (parsed.type === GetRequestType.ById)
      assert.strictEqual(parsed.entitySetName, "Posts");
  });

  it ("should parse the URI /Content(42)", () => {
    const parser = initGetRequestParser();
    const parsed = parser.parse({ relativeUrl: "/Content(42)", body: `` });
    assert.deepEqual(parsed, {
      entitySetName: "Content",
      id: { type: "Edm.Int32", value: 42 },
      type: GetRequestType.ById,
    });
  });

  it ("should parse nested $expand (OData v4)", () => {
    const parser = initGetRequestParser();
    const parsed = parser.parse({ relativeUrl: "/Posts?$expand=Children($expand=Content)", body: `` });
    assert.deepEqual(parsed, {
      entitySetName: "Posts",
      type: GetRequestType.Collection,
      expandTree: { Children: { Content: {} } },
      filterExpression: undefined,
    });
  });
});

function initPatchRequestParser(): IPostRequestParser {
  return new PatchRequestParser();
}

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
  public visitStringLiteral() { /* */ }
  public visitNumericLiteral() { /* */ }
  public visitNull() { /* */ }
  public visitAndExpression() { /* */ }
  public visitOrExpression() { /* */ }
  public visitEqExpression() { /* */ }
  public visitParentheses() { /* */ }
  public visitPropertyValue() { /* */ }
  public visitAnyExpression() { /* */ }
  public visitNotExpression() { /* */ }
}
