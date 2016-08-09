import odataParser = require("../src/odata/parser");
import queryTestCases = require("./helpers/querytestcases");

describe("ODataParser", function() {
  it("should parse an OData filter expression", function() {
    let parser = initODataParser();
    let evaluated = parser.parse("Posts?$filter=a/b/c eq 1");

    expect(evaluated.queryOptions).toBeDefined();
    expect(evaluated.queryOptions.filter).toBeDefined();
    expect(evaluated.queryOptions.filter.type).toEqual("operator");
    expect(evaluated.queryOptions.filter.lhs.type).toEqual("member-expression");
    expect(evaluated.queryOptions.filter.rhs.type).toEqual("decimalValue");
  });

  it("should parse an OData expand expression", function() {
    let parser = initODataParser();
    let result = parser.parse("Posts?$expand=Children/ReferredFrom");

    expect(result.queryOptions.expand.length).toEqual(1);
    expect(result.queryOptions.expand[0].path[0]).toEqual("Children");
    expect(result.queryOptions.expand[0].path[1]).toEqual("ReferredFrom");
  });

  it("should parse a simple filter expression", () => {
    let parser = initODataParser();
    let result = parser.parse("Posts?$filter='2' eq '1'");

    let filterOption = result.queryOptions.filter;
    expect(filterOption.type).toBe("operator");
    expect(filterOption.op).toBe("eq");
    expect(filterOption.rhs.type).toBe("string");
    expect(filterOption.rhs.value).toBe("1");
  });

  it("should parse a simple member expression", () => {
    let parser = initODataParser();
    let result = parser.parse("Posts?$filter=Id eq '1'");

    let filterOption = result.queryOptions.filter;
    expect(filterOption.lhs.type).toBe("member-expression");
    expect(filterOption.lhs.path.length).toBe(1);
    expect(filterOption.lhs.path[0]).toBe("Id");
    expect(filterOption.lhs.operation).toBe("property-value");
  });

  it("should parse a simple any expression", () => {
    let parser = initODataParser();
    let result = parser.parse("Posts?$filter=Children/any(it: it/Id eq 2)");

    let filterOption = result.queryOptions.filter;
    expect(filterOption.type).toBe("member-expression");
    expect(filterOption.operation).toBe("any");
    expect(filterOption.path).toEqual(["Children"]);
    expect(filterOption.lambdaExpression.variable).toBe("it");
    expect(filterOption.lambdaExpression.predicateExpression.type).toBe("operator");
  });

  it("should accept parentheses in a filter expression", () => {
    let parser = initODataParser();
    let result = parser.parse("Posts?$filter=(Id eq '1')");

    let filterOption = result.queryOptions.filter;
    expect(filterOption.type).toBe("parentheses-expression");
    expect(filterOption.inner.type).toBe("operator");
  });
});

describe("ODataParser (generated tests)", () => {
  queryTestCases.odataParserTests.forEach(
    (args, i) => spec(`#${i}`, args)
  );

  function spec(name: string, args: queryTestCases.IODataParserTestCase) {
    it(name, () => {
      let parser = initODataParser();

      let ast = parser.parse(args.query);

      expect(ast).toEqual(args.ast);
    });
  }
});

function initODataParser(): odataParser.IODataParser {
  return new odataParser.ODataParser();
}
