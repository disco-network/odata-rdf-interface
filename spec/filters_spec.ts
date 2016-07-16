import filters = require("../src/adapter/filters");

describe("A filter factory", () => {
  it("should choose the right FilterExpression-implementing class", () => {
    let raw = {
      type: "operator",
      op: "eq",
      lhs: { type: "string", value: "1" },
      rhs: { type: "string", value: "2" },
    };

    let factory = new filters.FilterExpressionFactory();
    factory.registerDefaultFilterExpressions();
    let filter = factory.fromRaw(raw);

    expect(filter instanceof filters.EqExpression).toBe(true);
    expect((filter as filters.EqExpression)["lhs"] instanceof filters.StringLiteralExpression).toBe(true);
    expect((filter as filters.EqExpression)["rhs"] instanceof filters.StringLiteralExpression).toBe(true);
  });
  it("should throw if there's no matching expression", () => {
    let raw = { type: "is-42", value: "4*2" };
    let factory = new filters.FilterExpressionFactory();

    expect(() => factory.fromRaw(raw)).toThrow();
  });
});

describe("A StringLiteralExpression", () => {
  it("should render to a SPARQL string", () => {
    let expr = filters.StringLiteralExpression.create({ type: "string", value: "cat" }, null, null);
    expect(expr.toSparql()).toBe("'cat'");
  });

  xit("should escape special characters", () => undefined);
});

describe("A NumberLiteralExpression", () => {
  it("should apply to numbers", () => {
    expect(filters.NumberLiteralExpression.doesApplyToRaw(
      { type: "decimalValue", value: "1" }
    )).toBe(true);
  });

  it("should render to a SPARQL string", () => {
    let expr = filters.NumberLiteralExpression.create({ type: "decimalValue", value: "1" }, null, null);
    expect(expr.toSparql()).toBe("'1'");
  });

  it("should disallow non-number values", () => {
    expect(() => {
      filters.NumberLiteralExpression.create({
        type: "decimalValue", value: "cat",
      }, null, null);
    }).toThrow();
  });
});

describe("An EqExpression", () => {
  it("should render to a SPARQL string", () => {
    let factory = new filters.FilterExpressionFactory();
    factory.registerDefaultFilterExpressions();
    factory.registerFilterExpression(TestFilterExpression);
    let expr = factory.fromRaw({ type: "operator", op: "eq",
      lhs: { type: "test", value: "(lhs)" },
      rhs: { type: "test", value: "(rhs)" },
    });

    expect(expr.toSparql()).toBe("((lhs) = (rhs))");
  });
});

describe("An OrExpression", () => {
  it("should render to SPARQL", () => {
    let factory = new filters.FilterExpressionFactory();
    factory.registerDefaultFilterExpressions();
    factory.registerFilterExpression(TestFilterExpression);
    let expr = factory.fromRaw({ type: "operator", op: "or",
      lhs: { type: "test", value: "(lhs)" },
      rhs: { type: "test", value: "(rhs)" },
    });

    expect(expr.toSparql()).toBe("((lhs) || (rhs))");
  });
});

describe("A PropertyExpression", () => {
  it("should apply to OData member expressions", () => {
    expect(filters.PropertyExpression.doesApplyToRaw({
      type: "member-expression",
    })).toBe(true);
  });

  xit("should handle simple 'any' expressions", () => {
    let factory = new filters.FilterExpressionFactory()
      .registerDefaultFilterExpressions()
      .registerFilterExpression(TestFilterExpression);
    let expr = factory.fromRaw({
      type: "member-expression", operator: "any", path: [ "Children" ],
      lambdaExpression: {
        variable: "it", predicateExpression: { type: "text", value: "(test)" },
      },
    });

    expect(expr.toSparql()).toBe("EXISTS { ?x0 disco:parent ?root . FILTER((test)) }");
  });
});

class TestFilterExpression implements filters.FilterExpression {
  public static doesApplyToRaw(raw) { return raw.type === "test"; }
  public static create(raw, factory) { return new TestFilterExpression(raw.value); }

  constructor(public value) {}
  public getSubExpressions(): filters.FilterExpression[] { return []; }
  public getPropertyTree(): filters.PropertyTree { return {}; }
  public toSparql(): string { return this.value.toString(); }
}
