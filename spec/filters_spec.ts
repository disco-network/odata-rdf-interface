import filters = require("../src/adapter/filters");
import mappings = require("../src/adapter/mappings");
import schemaModule = require("../src/odata/schema");
import propertyTree = require("../src/adapter/propertytree/propertytree");
import propertyTreeImpl = require("../src/adapter/propertytree/propertytree_impl");
import filterPatterns = require("../src/adapter/filterpatterns");
let schema = new schemaModule.Schema();

describe("A filter factory", () => {
  it("should choose the right FilterExpression-implementing class", () => {
    let raw = {
      type: "operator",
      op: "eq",
      lhs: { type: "string", value: "1" },
      rhs: { type: "string", value: "2" },
    };

    let factory = createFilterExpressionFactory();
    let filter = factory.fromRaw(raw);

    expect(filter instanceof filters.BinaryOperatorExpression).toBe(true);
    expect(filter["lhs"] instanceof filters.LiteralExpression).toBe(true);
    expect(filter["rhs"] instanceof filters.LiteralExpression).toBe(true);
  });
  it("should throw if there's no matching expression", () => {
    let raw = { type: "is-42", value: "4*2" };
    let factory = createFilterExpressionFactory();

    expect(() => factory.fromRaw(raw)).toThrow();
  });
  it("should pass a factory to the FilterExpression", () => {
    let raw = { type: "test" };
    let factory = createFilterExpressionFactory();
    let args = (factory.fromRaw(raw) as TestFilterExpression).args;

    expect(args.factory).toBeDefined();
  });
  xit("should be clonable", () => undefined);
});

describe("A StringLiteralExpression", () => {
  it("should render to a SPARQL string", () => {
    let expr = filters.StringLiteralExpressionFactory.fromRaw({ type: "string", value: "cat" }, createNullArgs());
    expect(expr.toSparql()).toBe("'cat'");
  });

  xit("should escape special characters", () => undefined);
});

describe("A NumberLiteralExpression", () => {
  it("should apply to numbers", () => {
    expect(filters.NumberLiteralExpressionFactory.doesApplyToRaw(
      { type: "decimalValue", value: "1" }
    )).toBe(true);
  });

  it("should render to a SPARQL string", () => {
    let expr = filters.NumberLiteralExpressionFactory.fromRaw({ type: "decimalValue", value: "1" }, createNullArgs());
    expect(expr.toSparql()).toBe("'1'");
  });

  it("should disallow non-number values", () => {
    expect(() => {
      filters.NumberLiteralExpressionFactory.fromRaw({
        type: "decimalValue", value: "cat",
      },
      { factory: null, filterContext: null });
    }).toThrow();
  });
});

describe("An EqExpression", () => {
  it("should render to a SPARQL string", () => {
    let factory = createFilterExpressionFactory();
    let expr = factory.fromRaw({ type: "operator", op: "eq",
      lhs: { type: "test", value: "(lhs)" },
      rhs: { type: "test", value: "(rhs)" },
    });

    expect(expr.toSparql()).toBe("((lhs) = (rhs))");
  });
});

describe("An OrExpression", () => {
  it("should render to SPARQL", () => {
    let factory = createFilterExpressionFactory();
    let expr = factory.fromRaw({ type: "operator", op: "or",
      lhs: { type: "test", value: "(lhs)" },
      rhs: { type: "test", value: "(rhs)" },
    });

    expect(expr.toSparql()).toBe("((lhs) || (rhs))");
  });
});

describe("A PropertyExpression", () => {
  it("should apply to OData member expressions", () => {
    expect(new filters.PropertyExpressionFactory(null).doesApplyToRaw({
      type: "member-expression",
    })).toBe(true);
  });

  it("should handle simple 'any' expressions", () => {
    let vargen = new mappings.SparqlVariableGenerator();
    let mapping = new mappings.Mapping(
      new mappings.PropertyMapping(schema.getEntityType("Post")),
      new mappings.StructuredSparqlVariableMapping("?root", vargen)
    );
    let expr = createPropertyExpressionFactory().fromRaw({
      type: "member-expression", operation: "any", path: [ "Children" ],
      lambdaExpression: {
        variable: "it", predicateExpression: { type: "test", value: "{test}" },
      },
    }, {
      factory: createFilterExpressionFactory(),
      filterContext: {
        scope: {
          entityType: schema.getEntityType("Post"),
          unscopedEntityType: schema.getEntityType("Post"),
          lambdaVariableScope: new filters.LambdaVariableScope(),
        },
        mapping: {
          mapping: mapping, scopedMapping: new mappings.ScopedMapping(mapping),
        },
      },
    });

    expect(expr.toSparql()).toBe("EXISTS { { { OPTIONAL { ?x0 disco:parent ?root } } } . FILTER({test}) }");
  });

  it("should not insert the collection property of 'any' operations into the property tree", () => {
    let expr = createPropertyExpressionFactory().fromRaw({
      type: "member-expression", operation: "any", path: [ "A", "B", "Children" ],
      lambdaExpression: {
        variable: "it", predicateExpression: { type: "test", value: "{test}" },
      },
    }, {
      factory: createFilterExpressionFactory(),
      filterContext: {
        scope: {
          entityType: null,
          unscopedEntityType: null,
          lambdaVariableScope: new filters.LambdaVariableScope(),
        },
        mapping: {
          mapping: null, scopedMapping: null,
        },
      },
    });

    expect(expr.getPropertyTree().root.toDataObject()).toEqual({ A: { B: {} } });
    expect(expr.getPropertyTree().inScopeVariables.toDataObject()).toEqual({});
  });

  it("should process properties of the root entity in 'any' expessions", () => {
    let mapping = new mappings.Mapping(
      new mappings.PropertyMapping(schema.getEntityType("Post")),
      new mappings.StructuredSparqlVariableMapping("?root", new mappings.SparqlVariableGenerator())
    );
    let factory = new filters.FilterExpressionIoCContainer()
      .registerFilterExpression(createPropertyExpressionFactory())
      .setStandardFilterContext({
        scope: {
          entityType: schema.getEntityType("Post"),
          unscopedEntityType: schema.getEntityType("Post"),
          lambdaVariableScope: new filters.LambdaVariableScope(),
        },
        mapping: {
          mapping: mapping, scopedMapping: new mappings.ScopedMapping(mapping),
        },
      });
    let expr = factory.fromRaw({
      type: "member-expression", operation: "any", path: [ "Children" ],
      lambdaExpression: {
        variable: "it", predicateExpression: { type: "member-expression", operation: "property-value",
          path: [ "Id" ] },
      },
    });

    expect(expr.toSparql()).toBe("EXISTS { { OPTIONAL { ?root disco:id ?x1 } . "
      + "{ OPTIONAL { ?x0 disco:parent ?root } } } . FILTER(?x1) }");
  });

  it("should process properties of the lambda entity in 'any' expessions", () => {
    let mapping = new mappings.Mapping(
      new mappings.PropertyMapping(schema.getEntityType("Post")),
      new mappings.StructuredSparqlVariableMapping("?root", new mappings.SparqlVariableGenerator())
    );
    let factory = new filters.FilterExpressionIoCContainer()
      .registerFilterExpression(createPropertyExpressionFactory())
      .setStandardFilterContext({
      scope: {
        entityType: schema.getEntityType("Post"),
        unscopedEntityType: schema.getEntityType("Post"),
        lambdaVariableScope: new filters.LambdaVariableScope(),
      },
      mapping: {
        mapping: mapping, scopedMapping: new mappings.ScopedMapping(mapping),
      },
    });
    let expr = factory.fromRaw({
      type: "member-expression", operation: "any", path: [ "Children" ],
      lambdaExpression: {
        variable: "it", predicateExpression: { type: "member-expression", operation: "property-value",
          path: [ "it", "Id" ] },
      },
    });

    /* @todo is it a good idea to use _OPTIONAL_ { ?x0 disco:parent ?root } ? */
    expect(expr.toSparql()).toBe("EXISTS { { { OPTIONAL { ?x0 disco:parent ?root } } . "
      + "{ OPTIONAL { ?x0 disco:id ?x1 } } } . FILTER(?x1) }");
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

describe("A lambda variable scope", () => {
  it("should recall lambda expressions", () => {
    let lambda: filters.LambdaExpression = {
      variable: "it",
      entityType: null,
      scopeId: null,
    };
    let scope = new filters.LambdaVariableScope();
    scope.add(lambda);

    expect(scope.exists("it")).toBe(true);
    expect(scope.exists("undefined")).toBe(false);
    expect(scope.get("it")).toBe(lambda);
  });

  it("should be cloneable", () => {
    let scope = new filters.LambdaVariableScope();
    scope.add({
      variable: "it",
      entityType: null,
      scopeId: null,
    });
    let cloned = scope.clone();

    expect(scope.get("it")).toEqual(cloned.get("it"));
  });

  it("should make clones independently changeable", () => {
    let scope = new filters.LambdaVariableScope();
    let cloned = scope.clone();

    scope.add({ variable: "a", entityType: null, scopeId: null });
    cloned.add({ variable: "b", entityType: null, scopeId: null });

    expect(cloned.exists("a")).toBe(false);
    expect(scope.exists("b")).toBe(false);
  });

  it("should have chainable write methods", () => {
    expect(new filters.LambdaVariableScope()
      .add({ variable: "a", entityType: null, scopeId: null })
      .exists("a")).toBe(true);
  });

  it("should throw when assigning a variable twice", () => {
    expect(() => new filters.LambdaVariableScope()
      .add({ variable: "it", entityType: null, scopeId: null })
      .add({ variable: "it", entityType: null, scopeId: null })).toThrow();
  });
});

describe("A property path", () => {
  it("should detect the in-scope variable prefix", () => {
    let path = new filters.PropertyPath([ "it" ], {
      scope: {
        entityType: null,
        unscopedEntityType: null,
        lambdaVariableScope: new filters.LambdaVariableScope().add({
        variable: "it", entityType: null, scopeId: null,
      }),
      },
      mapping: {
        mapping: null, scopedMapping: null,
      },
    });

    expect(path.pathStartsWithLambdaPrefix()).toBe(true);
  });
});

function createPropertyExpressionFactory() {
  return new filters.PropertyExpressionFactory(createFilterPatternStrategy());
}

function createFilterPatternStrategy() {
  return new filterPatterns.FilterGraphPatternStrategy(createBranchFactory());
}

function createBranchFactory() {
  return new propertyTree.TreeDependencyInjector()
      .registerFactoryCandidates(
        new propertyTreeImpl.ComplexBranchFactoryForFiltering(),
        new propertyTreeImpl.ElementaryBranchFactoryForFiltering(),
        new propertyTreeImpl.InScopeVariableBranchFactory(),
        new propertyTreeImpl.AnyBranchFactory()
      );
}

function createFilterExpressionFactory() {
  let factory = new filters.FilterExpressionIoCContainer()
    .registerFilterExpressions([
      filters.StringLiteralExpressionFactory, filters.NumberLiteralExpressionFactory,
      filters.AndExpressionFactory, filters.OrExpressionFactory,
      filters.EqExpressionFactory, filters.ParenthesesExpressionFactory,
      TestFilterExpression,
    ])
    .setStandardFilterContext({
      scope: {
        entityType: null,
        unscopedEntityType: null,
        lambdaVariableScope: new filters.LambdaVariableScope(),
      },
      mapping: {
        mapping: null, scopedMapping: null,
      },
    });
  return factory;
}

function createNullArgs() {
  return { mapping: null, entityType: null, factory: null };
}

class TestFilterExpression implements filters.FilterExpression {
  public static doesApplyToRaw(raw) { return raw.type === "test"; }
  public static fromRaw(raw, args: filters.FilterExpressionArgs) { return new TestFilterExpression(raw.value, args); }

  constructor(public value, public args: filters.FilterExpressionArgs) {}
  public getSubExpressions(): filters.FilterExpression[] { return []; }
  public getPropertyTree(): filters.ScopedPropertyTree { return new filters.ScopedPropertyTree(); }
  public toSparql(): string { return this.value.toString(); }
}
