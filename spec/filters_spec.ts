import filters = require("../src/adapter/filters");
import mappings = require("../src/adapter/mappings");
import schemaModule = require("../src/odata/schema");
let schema = new schemaModule.Schema();

describe("A filter factory", () => {
  it("should choose the right FilterExpression-implementing class", () => {
    let raw = {
      type: "operator",
      op: "eq",
      lhs: { type: "string", value: "1" },
      rhs: { type: "string", value: "2" },
    };

    let factory = createTestFilterExpressionFactory();
    let filter = factory.fromRaw(raw);

    expect(filter instanceof filters.EqExpression).toBe(true);
    expect((filter as filters.EqExpression)["lhs"] instanceof filters.StringLiteralExpression).toBe(true);
    expect((filter as filters.EqExpression)["rhs"] instanceof filters.StringLiteralExpression).toBe(true);
  });
  it("should throw if there's no matching expression", () => {
    let raw = { type: "is-42", value: "4*2" };
    let factory = createTestFilterExpressionFactory();

    expect(() => factory.fromRaw(raw)).toThrow();
  });
  it("should pass the factory to the FilterExpression", () => {
    let raw = { type: "test" };
    let factory = createTestFilterExpressionFactory();
    let args = (factory.fromRaw(raw) as TestFilterExpression).args;

    expect(args.factory).toBeDefined();
    expect(args.factory).toBe(factory);
  });
  xit("should be clonable", () => undefined);
});

describe("A StringLiteralExpression", () => {
  it("should render to a SPARQL string", () => {
    let expr = filters.StringLiteralExpression.create({ type: "string", value: "cat" }, createNullArgs());
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
    let expr = filters.NumberLiteralExpression.create({ type: "decimalValue", value: "1" }, createNullArgs());
    expect(expr.toSparql()).toBe("'1'");
  });

  it("should disallow non-number values", () => {
    expect(() => {
      filters.NumberLiteralExpression.create({
        type: "decimalValue", value: "cat",
      }, { factory: null, filterContext: { entityType: null, mapping: null, lambdaVariableScope: {} } });
    }).toThrow();
  });
});

describe("An EqExpression", () => {
  it("should render to a SPARQL string", () => {
    let factory = createTestFilterExpressionFactory();
    let expr = factory.fromRaw({ type: "operator", op: "eq",
      lhs: { type: "test", value: "(lhs)" },
      rhs: { type: "test", value: "(rhs)" },
    });

    expect(expr.toSparql()).toBe("((lhs) = (rhs))");
  });
});

describe("An OrExpression", () => {
  it("should render to SPARQL", () => {
    let factory = createTestFilterExpressionFactory();
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

  it("should handle simple 'any' expressions", () => {
    let vargen = new mappings.SparqlVariableGenerator();
    let mapping = new mappings.StructuredSparqlVariableMapping("?root", vargen);
    let expr = filters.PropertyExpression.create({
      type: "member-expression", operation: "any", path: [ "Children" ],
      lambdaExpression: {
        variable: "it", predicateExpression: { type: "test", value: "{test}" },
      },
    }, {
      factory: createTestFilterExpressionFactory(),
      filterContext: {
        mapping: mapping,
        entityType: schema.getEntityType("Post"),
        lambdaVariableScope: {},
      },
    });

    expect(expr.toSparql()).toBe("EXISTS { { OPTIONAL { ?x0 disco:parent ?root } } . FILTER({test}) }");
  });

  it("should not insert the collection property of 'any' operations into the property tree", () => {
    let expr = filters.PropertyExpression.create({
      type: "member-expression", operation: "any", path: [ "A", "B", "Children" ],
      lambdaExpression: {
        variable: "it", predicateExpression: { type: "test", value: "{test}" },
      },
    }, {
      factory: createTestFilterExpressionFactory(),
      filterContext: {
        mapping: null,
        entityType: null,
        lambdaVariableScope: {},
      },
    });

    expect(expr.getPropertyTree().root.toDataObject()).toEqual({ A: { B: {} } });
    expect(expr.getPropertyTree().inScopeVariables.toDataObject()).toEqual({});
  });

  it("should process properties of the root entity in 'any' expessions", () => {
    let factory = new filters.FilterExpressionFactory()
      .registerDefaultFilterExpressions()
      .setFilterContext({
        mapping: new mappings.StructuredSparqlVariableMapping("?root", new mappings.SparqlVariableGenerator()),
        entityType: schema.getEntityType("Post"),
        lambdaVariableScope: {},
      });
    let expr = factory.fromRaw({
      type: "member-expression", operation: "any", path: [ "Children" ],
      lambdaExpression: {
        variable: "it", predicateExpression: { type: "member-expression", operation: "property-value",
          path: [ "Id" ] },
      },
    });

    expect(expr.toSparql()).toBe("EXISTS { OPTIONAL { ?root disco:id ?x0 } . "
      + "{ OPTIONAL { ?x1 disco:parent ?root } } . FILTER(?x0) }");
  });

  it("should process properties of the lambda entity in 'any' expessions", () => {
    let factory = new filters.FilterExpressionFactory()
      .registerDefaultFilterExpressions()
      .setFilterContext({
        mapping: new mappings.StructuredSparqlVariableMapping("?root", new mappings.SparqlVariableGenerator()),
        entityType: schema.getEntityType("Post"),
        lambdaVariableScope: {},
      });
    let expr = factory.fromRaw({
      type: "member-expression", operation: "any", path: [ "Children" ],
      lambdaExpression: {
        variable: "it", predicateExpression: { type: "member-expression", operation: "property-value",
          path: [ "it", "Id" ] },
      },
    });

    /* @todo is it a good idea to use _OPTIONAL_ { ?x0 disco:parent ?root } ? */
    expect(expr.toSparql()).toBe("EXISTS { { OPTIONAL { ?x0 disco:id ?x1 } } . "
      + "{ OPTIONAL { ?x0 disco:parent ?root } } . FILTER(?x1) }");
  });
});

describe("A flat property tree", () => {
  it("should recall saved entries", () => {
    let tree = filters.FlatPropertyTree.empty();
    tree.createBranch("PropertyName").createBranch("SubProperty");
    expect(tree.branchExists("PropertyName")).toBe(true);
    expect(tree.branchExists("AsdfGhjk")).toBe(false);
    expect(tree.branchExists("undefined")).toBe(false);
    expect(tree.getBranch("PropertyName").branchExists("SubProperty")).toBe(true);
    expect(tree.getIterator().current()).toBe("PropertyName");
  });

  xit("should be cloneable", () => {
    let tree = filters.FlatPropertyTree.fromDataObject({ "Content": { "Id": {} }, "Id": {} });

    expect(tree.clone().branchExists("Content")).toBe(true);
    expect(tree.clone().branchExists("Id")).toBe(true);
    expect(tree.clone().branchExists("undefined")).toBe(true);
    expect(tree.clone().getBranch("Content").branchExists("Id")).toBe(true);
  });

  it("should be mergeable", () => {
    let treeA = filters.FlatPropertyTree.fromDataObject({ "Content": { "Id": {} }, "Id": {} });
    let treeB = filters.FlatPropertyTree.fromDataObject({ "Content": { "Title": {} } });
    treeA.merge(treeB);

    expect(treeA.branchExists("Content"));
    expect(treeA.getBranch("Content").branchExists("Id"));
    expect(treeA.getBranch("Content").branchExists("Title"));
    expect(treeA.branchExists("Id"));
  });
});

function createTestFilterExpressionFactory() {
  let factory = new filters.FilterExpressionFactory()
    .registerDefaultFilterExpressions()
    .registerFilterExpression(TestFilterExpression)
    .setFilterContext({
      mapping: null,
      entityType: null,
      lambdaVariableScope: {},
    });
  return factory;
}

function createNullArgs() {
  return { mapping: null, entityType: null, factory: null };
}

class TestFilterExpression implements filters.FilterExpression {
  public static doesApplyToRaw(raw) { return raw.type === "test"; }
  public static create(raw, args: filters.FilterExpressionArgs) { return new TestFilterExpression(raw.value, args); }

  constructor(public value, public args: filters.FilterExpressionArgs) {}
  public getSubExpressions(): filters.FilterExpression[] { return []; }
  public getPropertyTree(): filters.ScopedPropertyTree { return new filters.ScopedPropertyTree(); }
  public toSparql(): string { return this.value.toString(); }
}
