import { assert } from "chai";

import filters = require("../src/adapter/filters");
import mappings = require("../src/adapter/mappings");
import schemaModule = require("../src/odata/schema");
import propertyTree = require("../src/adapter/propertytree/propertytree");
import propertyTreeImpl = require("../src/adapter/propertytree/propertytree_impl");
import filterPatterns = require("../src/adapter/filterpatterns");
let schema = new schemaModule.Schema();

describe("Filters.FilterToTranslatorChainOfResponsibility", () => {
  it("should choose the right IExpressionTranslator-implementing class", () => {
    let raw = {
      type: "operator",
      op: "eq",
      lhs: { type: "string", value: "1" },
      rhs: { type: "string", value: "2" },
    };

    let factory = createExpressionTranslatorFactory();
    let filter = factory.fromRaw(raw);

    assert.strictEqual(filter instanceof filters.BinaryOperatorTranslator, true);
    assert.strictEqual(filter["lhs"] instanceof filters.LiteralTranslator, true);
    assert.strictEqual(filter["rhs"] instanceof filters.LiteralTranslator, true);
  });
  it("should throw if there's no matching translator", () => {
    let raw = { type: "is-42", value: "4*2" };
    let factory = createExpressionTranslatorFactory();

    assert.throws(() => factory.fromRaw(raw));
  });
  it("should pass a factory to the ExpressionTranslator", () => {
    let raw = { type: "test" };
    let factory = createExpressionTranslatorFactory();
    let args = (factory.fromRaw(raw) as TestFilterExpression).args;

    assert.isDefined(args.factory);
  });
  xit("should be clonable", () => undefined);
});

describe("A StringLiteralTranslator", () => {
  it("should render to a SPARQL string", () => {
    let expr = filters.StringLiteralTranslatorFactory.fromRaw({ type: "string", value: "cat" }, createNullArgs());
    assert.strictEqual(expr.toSparqlFilterClause(), "'cat'");
  });

  xit("should escape special characters", () => undefined);
});

describe("A NumberLiteralTranslator", () => {
  it("should apply to numbers", () => {
    assert.strictEqual(filters.NumericLiteralTranslatorFactory.doesApplyToRaw(
      { type: "decimalValue", value: "1" }
    ), true);
  });

  it("should render to a SPARQL filter clause", () => {
    let expr = filters.NumericLiteralTranslatorFactory.fromRaw({ type: "decimalValue", value: "1" }, createNullArgs());
    assert.strictEqual(expr.toSparqlFilterClause(), "'1'");
  });

  it("should disallow non-number values", () => {
    assert.throws(() => {
      filters.NumericLiteralTranslatorFactory.fromRaw({
        type: "decimalValue", value: "cat",
      },
      { factory: null, filterContext: null });
    });
  });
});

describe("An EqTranslator", () => {
  it("should render to a SPARQL string", () => {
    let factory = createExpressionTranslatorFactory();
    let expr = factory.fromRaw({ type: "operator", op: "eq",
      lhs: { type: "test", value: "(lhs)" },
      rhs: { type: "test", value: "(rhs)" },
    });

    assert.strictEqual(expr.toSparqlFilterClause(), "((lhs) = (rhs))");
  });
});

describe("An OrTranslator", () => {
  it("should render to SPARQL", () => {
    let factory = createExpressionTranslatorFactory();
    let expr = factory.fromRaw({ type: "operator", op: "or",
      lhs: { type: "test", value: "(lhs)" },
      rhs: { type: "test", value: "(rhs)" },
    });

    assert.strictEqual(expr.toSparqlFilterClause(), "((lhs) || (rhs))");
  });
});

describe("A PropertyTranslator", () => {
  it("should apply to OData member expressions", () => {
    assert.strictEqual(new filters.PropertyTranslatorFactory(null).doesApplyToRaw({
      type: "member-expression",
    }), true);
  });

  it("should handle simple 'any' expressions", () => {
    let vargen = new mappings.SparqlVariableGenerator();
    let mapping = new mappings.Mapping(
      new mappings.PropertyMapping(schema.getEntityType("Post")),
      new mappings.StructuredSparqlVariableMapping("?root", vargen)
    );
    let expr = createPropertyTranslatorFactory().fromRaw({
      type: "member-expression", operation: "any", path: [ "Children" ],
      lambdaExpression: {
        variable: "it", predicateExpression: { type: "test", value: "{test}" },
      },
    }, {
      factory: createExpressionTranslatorFactory(),
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

    assert.strictEqual(expr.toSparqlFilterClause(),
      "EXISTS { { { OPTIONAL { ?x0 disco:parent ?root } } } . FILTER({test}) }");
  });

  it("should not include the last property before 'any' into the property tree of the lambda expression", () => {
    let expr = createPropertyTranslatorFactory().fromRaw({
      type: "member-expression", operation: "any", path: [ "A", "B", "Children" ],
      lambdaExpression: {
        variable: "it", predicateExpression: { type: "test", value: "{test}" },
      },
    }, {
      factory: createExpressionTranslatorFactory(),
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

    assert.deepEqual(expr.getPropertyTree().root.toDataObject(), { A: { B: {} } });
    assert.deepEqual(expr.getPropertyTree().inScopeVariables.toDataObject(), {});
  });

  it("should process properties of the root entity in 'any' expessions", () => {
    let mapping = new mappings.Mapping(
      new mappings.PropertyMapping(schema.getEntityType("Post")),
      new mappings.StructuredSparqlVariableMapping("?root", new mappings.SparqlVariableGenerator())
    );
    let factory = new filters.FilterToTranslatorChainOfResponsibility()
      .pushHandler(createPropertyTranslatorFactory());
    let expr = factory.fromRaw({
      type: "member-expression", operation: "any", path: [ "Children" ],
      lambdaExpression: {
        variable: "it", predicateExpression: { type: "member-expression", operation: "property-value",
          path: [ "Id" ] },
      },
    }, {
      scope: {
        entityType: schema.getEntityType("Post"),
        unscopedEntityType: schema.getEntityType("Post"),
        lambdaVariableScope: new filters.LambdaVariableScope(),
      },
      mapping: {
        mapping: mapping, scopedMapping: new mappings.ScopedMapping(mapping),
      },
    });

    assert.strictEqual(expr.toSparqlFilterClause(), "EXISTS { { OPTIONAL { ?root disco:id ?x1 } . "
      + "{ OPTIONAL { ?x0 disco:parent ?root } } } . FILTER(?x1) }");
  });

  it("should process properties of the lambda entity in 'any' expessions", () => {
    let mapping = new mappings.Mapping(
      new mappings.PropertyMapping(schema.getEntityType("Post")),
      new mappings.StructuredSparqlVariableMapping("?root", new mappings.SparqlVariableGenerator())
    );
    let factory = new filters.FilterToTranslatorChainOfResponsibility()
      .pushHandler(createPropertyTranslatorFactory());
    let expr = factory.fromRaw({
      type: "member-expression", operation: "any", path: [ "Children" ],
      lambdaExpression: {
        variable: "it", predicateExpression: { type: "member-expression", operation: "property-value",
          path: [ "it", "Id" ] },
      },
    }, {
      scope: {
        entityType: schema.getEntityType("Post"),
        unscopedEntityType: schema.getEntityType("Post"),
        lambdaVariableScope: new filters.LambdaVariableScope(),
      },
      mapping: {
        mapping: mapping, scopedMapping: new mappings.ScopedMapping(mapping),
      },
    });

    /* @todo is it a good idea to use _OPTIONAL_ { ?x0 disco:parent ?root } ? */
    assert.strictEqual(expr.toSparqlFilterClause(), "EXISTS { { { OPTIONAL { ?x0 disco:parent ?root } } . "
      + "{ OPTIONAL { ?x0 disco:id ?x1 } } } . FILTER(?x1) }");
  });
});

describe("A flat property tree", () => {
  it("should recall saved entries", () => {
    let tree = filters.FlatPropertyTree.empty();
    tree.createBranch("PropertyName").createBranch("SubProperty");
    assert.strictEqual(tree.branchExists("PropertyName"), true);
    assert.strictEqual(tree.branchExists("AsdfGhjk"), false);
    assert.strictEqual(tree.branchExists("undefined"), false);
    assert.strictEqual(tree.getBranch("PropertyName").branchExists("SubProperty"), true);
    assert.strictEqual(tree.getIterator().current(), "PropertyName");
  });

  xit("should be cloneable", () => {
    let tree = filters.FlatPropertyTree.fromDataObject({ "Content": { "Id": {} }, "Id": {} });

    assert.strictEqual(tree.clone().branchExists("Content"), true);
    assert.strictEqual(tree.clone().branchExists("Id"), true);
    assert.strictEqual(tree.clone().branchExists("undefined"), true);
    assert.strictEqual(tree.clone().getBranch("Content").branchExists("Id"), true);
  });

  it("should be mergeable", () => {
    let treeA = filters.FlatPropertyTree.fromDataObject({ "Content": { "Id": {} }, "Id": {} });
    let treeB = filters.FlatPropertyTree.fromDataObject({ "Content": { "Title": {} } });
    treeA.merge(treeB);

    assert.strictEqual(treeA.branchExists("Content"), true);
    assert.strictEqual(treeA.getBranch("Content").branchExists("Id"), true);
    assert.strictEqual(treeA.getBranch("Content").branchExists("Title"), true);
    assert.strictEqual(treeA.branchExists("Id"), true);
  });
});

describe("A lambda variable scope", () => {
  it("should recall lambda expressions", () => {
    let lambda: filters.ILambdaExpression = {
      variable: "it",
      entityType: null,
      scopeId: null,
    };
    let scope = new filters.LambdaVariableScope();
    scope.add(lambda);

    assert.strictEqual(scope.exists("it"), true);
    assert.strictEqual(scope.exists("undefined"), false);
    assert.strictEqual(scope.get("it"), lambda);
  });

  it("should be cloneable", () => {
    let scope = new filters.LambdaVariableScope();
    scope.add({
      variable: "it",
      entityType: null,
      scopeId: null,
    });
    let cloned = scope.clone();

    assert.strictEqual(scope.get("it"), cloned.get("it"));
  });

  it("should make clones independently changeable", () => {
    let scope = new filters.LambdaVariableScope();
    let cloned = scope.clone();

    scope.add({ variable: "a", entityType: null, scopeId: null });
    cloned.add({ variable: "b", entityType: null, scopeId: null });

    assert.strictEqual(cloned.exists("a"), false);
    assert.strictEqual(scope.exists("b"), false);
  });

  it("should have chainable write methods", () => {
    assert.strictEqual(new filters.LambdaVariableScope()
      .add({ variable: "a", entityType: null, scopeId: null })
      .exists("a"), true);
  });

  it("should throw when assigning a variable twice", () => {
    assert.throws(() => new filters.LambdaVariableScope()
      .add({ variable: "it", entityType: null, scopeId: null })
      .add({ variable: "it", entityType: null, scopeId: null }));
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

    assert.strictEqual(path.pathStartsWithLambdaPrefix(), true);
  });
});

function createPropertyTranslatorFactory() {
  return new filters.PropertyTranslatorFactory(createFilterPatternStrategy());
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

function createExpressionTranslatorFactory() {
  let factory = new filters.FilterToTranslatorChainOfResponsibility()
    .pushHandlers([
      filters.StringLiteralTranslatorFactory, filters.NumericLiteralTranslatorFactory,
      filters.AndTranslatorFactory, filters.OrTranslatorFactory,
      filters.EqTranslatorFactory, filters.ParenthesesTranslatorFactory,
      TestFilterExpression,
    ])
    .createFactoryWithFilterContext({
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

class TestFilterExpression implements filters.IExpressionTranslator {
  public static doesApplyToRaw(raw) { return raw.type === "test"; }
  public static fromRaw(raw, args: filters.IExpressionTranslatorArgs) {
    return new TestFilterExpression(raw.value, args);
  }

  constructor(public value, public args: filters.IExpressionTranslatorArgs) {}
  public getSubExpressions(): filters.IExpressionTranslator[] { return []; }
  public getPropertyTree(): filters.ScopedPropertyTree { return new filters.ScopedPropertyTree(); }
  public toSparqlFilterClause(): string { return this.value.toString(); }
}
