import { assert } from "chai";

import {
  IStringLiteral, INumericLiteral,
  IEqExpression, IAndExpression, IOrExpression, IAnyExpression,
} from "../src/odata/filters/expressions";
import {
  IVisitorState, IVisitor, VisitorBase, AssembledVisitor,
  PropertyPath,
  LiteralVisitor, ILiteralVisitor, BinaryExprVisitor, IBinaryExprVisitor, generatePropertyVisitor, IPropertyVisitor,
  IExpressionTranslator } from "../src/adapter/filtertranslators";
import { IAnyExpressionTranslatorFactory, AnyExpressionTranslator } from "../src/adapter/filters/propertyexpression";
import { FilterGraphPatternStrategy } from "../src/adapter/filterpatterns";
import propertyTree = require("../src/adapter/propertytree/propertytree");
import propertyTreeImpl = require("../src/adapter/propertytree/propertytree_impl");
import {
  SparqlVariableGenerator, StructuredSparqlVariableMapping,
  Mapping, PropertyMapping, ScopedMapping,
} from "../src/adapter/mappings";
import { FlatPropertyTree, ScopedPropertyTree } from "../src/odata/filters/propertytree";
import { ILambdaVariable, LambdaVariableScope, UniqueScopeIdentifier } from "../src/odata/filters/filters";
import { Schema } from "../src/odata/schema";
const schema = new Schema();

interface MyLiteralVisitor extends IVisitor, ILiteralVisitor {}
interface MyBinaryVisitor extends IVisitor, IBinaryExprVisitor, ITestExprVisitor {}
interface MyPropertyVisitor extends IVisitor, IPropertyVisitor, ITestExprVisitor {}
const MyLiteralVisitor = AssembledVisitor<MyLiteralVisitor>(VisitorBase, [LiteralVisitor]);
const MyBinaryVisitor = AssembledVisitor<MyBinaryVisitor>(VisitorBase, [TestExprVisitor, BinaryExprVisitor]);
function MyPropertyVisitor(anyTrans: IAnyExpressionTranslatorFactory) {
  return AssembledVisitor<MyPropertyVisitor>(VisitorBase, [TestExprVisitor, generatePropertyVisitor(anyTrans)]);
}

describe("Adapter.LiteralVisitor:", () => {
  it("should translate 'cat' to the correct SPARQL expression", () => {
    const visitor = new MyLiteralVisitor(createNullState());

    const expr: IStringLiteral<MyLiteralVisitor> = {
      accept: v => v.visitStringLiteral(expr),
      getString: () => "cat",
    };
    const sparql = visitor.create(expr).toSparqlFilterClause();

    assert.strictEqual(sparql, "'cat'");
  });

  xit("should escape special characters in strings", () => undefined);

  it("should translate 1 to the correct SPARQL expression", () => {
    const visitor = new MyLiteralVisitor(createNullState());

    const expr: INumericLiteral<typeof visitor> = {
      accept: v => v.visitNumericLiteral(expr),
      getNumber: () => 1,
    };
    const sparql = visitor.create(expr).toSparqlFilterClause();

    assert.strictEqual(sparql, "'1'");
  });
});

describe("Adapter.BinaryExprVisitor:", () => {
  it("should translate EQ expressions", () => {
    const visitor = new MyBinaryVisitor(createNullState());

    const expr: IEqExpression<typeof visitor> = new TestBinaryExpression<typeof visitor>();
    expr.accept = v => v.visitEqExpression(expr);
    const sparql = visitor.create(expr).toSparqlFilterClause();

    assert.strictEqual(sparql, "(LHS = RHS)");
  });

  it("should translate OR expressions", () => {
    const visitor = new MyBinaryVisitor(createNullState());

    const expr: IOrExpression<typeof visitor> = new TestBinaryExpression<typeof visitor>();
    expr.accept = v => v.visitOrExpression(expr);
    const sparql = visitor.create(expr).toSparqlFilterClause();

    assert.strictEqual(sparql, "(LHS || RHS)");
  });
  it("should translate AND expressions", () => {
    const visitor = new MyBinaryVisitor(createNullState());

    const expr: IAndExpression<typeof visitor> = new TestBinaryExpression<typeof visitor>();
    expr.accept = v => v.visitAndExpression(expr);
    const sparql = visitor.create(expr).toSparqlFilterClause();

    assert.strictEqual(sparql, "(LHS && RHS)");
  });
});

describe("Adapter.PropertyVisitor", () => {
  it("should create an AnyExpressionTranslator for /any expressions with the correct parameters", () => {
    /* @todo stub/mock PropertyPath */
    let counter = 0;
    const anyTranslatorFactory: IAnyExpressionTranslatorFactory = {
      create: (path, variable, lambdaExpression, filterContext) => {
        ++counter;
        assert.deepEqual(path, ["Children"]);
        assert.equal(variable.name, "it");
        assert.equal(variable.entityType.getName(), "Post");
        assert.equal(lambdaExpression.toSparqlFilterClause(), "LAMBDA");

        return new TestTranslator("ANY");
      },
    };

    const visitor = new (MyPropertyVisitor(anyTranslatorFactory))(createNullState());
    let expr: IAnyExpression<typeof visitor> = {
      accept: v => v.visitAnyExpression(expr),
      getPropertyPath: () => [ "Children" ],
      getLambdaExpression: () => ({
        variable: "it",
        expression: new TestExpression("LAMBDA"),
      }),
    };

    let vargen = new SparqlVariableGenerator();
    let mapping = new Mapping(
      new PropertyMapping(schema.getEntityType("Post")),
      new StructuredSparqlVariableMapping("?root", vargen)
    );

    const sparql = visitor.create(expr, {
      scope: {
        entityType: schema.getEntityType("Post"),
        lambdaVariableScope: new LambdaVariableScope(),
      },
      mapping: {
        scope: new ScopedMapping(mapping),
      },
    }).toSparqlFilterClause();

    assert.strictEqual(sparql, "ANY");
  });

  it("should pass the right inner FilterContext to the lambda expression", done => {

    let vargen = new SparqlVariableGenerator();
    let mapping = new Mapping(
      new PropertyMapping(schema.getEntityType("Post")),
      new StructuredSparqlVariableMapping("?root", vargen)
    );
    const anyTranslatorFactory: IAnyExpressionTranslatorFactory = {
      create: () => new TestTranslator("ANY"),
    };

    const visitor = new (MyPropertyVisitor(anyTranslatorFactory))(createNullState());
    visitor.visitTest = expr => {
      assert.strictEqual(
        visitor.getState().filterContext.mapping.scope.unscoped().variables.getVariable(),
        mapping.variables.getVariable());
      assert.strictEqual(
        visitor.getState().filterContext.scope.entityType.getName(), "Post");
      assert.strictEqual(
        visitor.getState().filterContext.scope.lambdaVariableScope.exists("it"), true);
      assert.strictEqual(
        visitor.getState().filterContext.scope.lambdaVariableScope.get("it").entityType.getName(), "Post");
      done();
    };
    let expr: IAnyExpression<typeof visitor> = {
      accept: v => v.visitAnyExpression(expr),
      getPropertyPath: () => [ "Children" ],
      getLambdaExpression: () => ({
        variable: "it",
        expression: new TestExpression("LAMBDA"),
      }),
    };

    const sparql = visitor.create(expr, {
      scope: {
        entityType: schema.getEntityType("Post"),
        lambdaVariableScope: new LambdaVariableScope(),
      },
      mapping: {
        scope: new ScopedMapping(mapping),
      },
    }).toSparqlFilterClause();

    assert.strictEqual(sparql, "ANY");
  });

  xit("should handle lambda-scoped properties");
  xit("should favor lambda-scoped over global-scoped properties");
});

describe("Adapter.AnyExpressionTranslator", () => {
  it("should translate simple /any expressions", () => {
    let vargen = new SparqlVariableGenerator();
    let mapping = new Mapping(
      new PropertyMapping(schema.getEntityType("Post")),
      new StructuredSparqlVariableMapping("?root", vargen)
    );
    let translator = new AnyExpressionTranslator(["Children"], {
      name: "it",
      entityType: schema.getEntityType("Post"),
      scopeId: new UniqueScopeIdentifier("test"),
    }, new TestTranslator("TEST"), {
      scope: {
        entityType: schema.getEntityType("Post"),
        lambdaVariableScope: new LambdaVariableScope(),
      },
      mapping: {
        scope: new ScopedMapping(mapping),
      },
    }, /* @todo mock */ createFilterPatternStrategy());
    assert.strictEqual(translator.toSparqlFilterClause(),
      "EXISTS { { { OPTIONAL { ?x0 disco:parent ?root } } } . FILTER(TEST) }");
  });
  it("should generate the property tree of an /any expression consisting of all path segments except the last one",
  () => {
    let translator = new AnyExpressionTranslator(["A", "B", "Children"], {
      name: "it",
      entityType: null,
      scopeId: new UniqueScopeIdentifier("test"),
    }, new TestTranslator("TEST"), {
      scope: {
        entityType: null,
        lambdaVariableScope: new LambdaVariableScope(),
      },
      mapping: {
        scope: null,
      },
    }, createFilterPatternStrategy());

    assert.deepEqual(translator.getPropertyTree().root.toDataObject(), { A: { B: {} } });
    assert.deepEqual(translator.getPropertyTree().inScopeVariables.toDataObject(), {});
  });
});

function createFilterPatternStrategy() {
  return new FilterGraphPatternStrategy(/* @todo mock */ createBranchFactory());
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

describe("A flat property tree", () => {
  it("should recall saved entries", () => {
    let tree = FlatPropertyTree.empty();
    tree.createBranch("PropertyName").createBranch("SubProperty");
    assert.strictEqual(tree.branchExists("PropertyName"), true);
    assert.strictEqual(tree.branchExists("AsdfGhjk"), false);
    assert.strictEqual(tree.branchExists("undefined"), false);
    assert.strictEqual(tree.getBranch("PropertyName").branchExists("SubProperty"), true);
    assert.strictEqual(tree.getIterator().current(), "PropertyName");
  });

  xit("should be cloneable", () => {
    let tree = FlatPropertyTree.fromDataObject({ "Content": { "Id": {} }, "Id": {} });

    assert.strictEqual(tree.clone().branchExists("Content"), true);
    assert.strictEqual(tree.clone().branchExists("Id"), true);
    assert.strictEqual(tree.clone().branchExists("undefined"), true);
    assert.strictEqual(tree.clone().getBranch("Content").branchExists("Id"), true);
  });

  it("should be mergeable", () => {
    let treeA = FlatPropertyTree.fromDataObject({ "Content": { "Id": {} }, "Id": {} });
    let treeB = FlatPropertyTree.fromDataObject({ "Content": { "Title": {} } });
    treeA.merge(treeB);

    assert.strictEqual(treeA.branchExists("Content"), true);
    assert.strictEqual(treeA.getBranch("Content").branchExists("Id"), true);
    assert.strictEqual(treeA.getBranch("Content").branchExists("Title"), true);
    assert.strictEqual(treeA.branchExists("Id"), true);
  });
});

describe("A lambda variable scope", () => {
  it("should recall lambda expressions", () => {
    let lambda: ILambdaVariable = {
      name: "it",
      entityType: null,
      scopeId: null,
    };
    let scope = new LambdaVariableScope();
    scope.add(lambda);

    assert.strictEqual(scope.exists("it"), true);
    assert.strictEqual(scope.exists("undefined"), false);
    assert.strictEqual(scope.get("it"), lambda);
  });

  it("should be cloneable", () => {
    let scope = new LambdaVariableScope();
    scope.add({
      name: "it",
      entityType: null,
      scopeId: null,
    });
    let cloned = scope.clone();

    assert.strictEqual(scope.get("it"), cloned.get("it"));
  });

  it("should make clones independently changeable", () => {
    let scope = new LambdaVariableScope();
    let cloned = scope.clone();

    scope.add({ name: "a", entityType: null, scopeId: null });
    cloned.add({ name: "b", entityType: null, scopeId: null });

    assert.strictEqual(cloned.exists("a"), false);
    assert.strictEqual(scope.exists("b"), false);
  });

  it("should have chainable write methods", () => {
    assert.strictEqual(new LambdaVariableScope()
      .add({ name: "a", entityType: null, scopeId: null })
      .exists("a"), true);
  });

  it("should throw when assigning a variable twice", () => {
    assert.throws(() => new LambdaVariableScope()
      .add({ name: "it", entityType: null, scopeId: null })
      .add({ name: "it", entityType: null, scopeId: null }));
  });
});

describe("A property path", () => {
  it("should detect the in-scope variable prefix", () => {
    let path = new PropertyPath([ "it" ], {
      scope: {
        entityType: null,
        lambdaVariableScope: new LambdaVariableScope().add({
        name: "it", entityType: null, scopeId: null,
      }),
      },
      mapping: {
        scope: null,
      },
    });

    assert.strictEqual(path.pathStartsWithLambdaPrefix(), true);
  });
});

function createNullState(): IVisitorState {
  return { filterContext: null };
}

class TestExpression {
  constructor(public value: string) {}

  public accept(visitor: ITestExprVisitor) {
    visitor.visitTest(this);
  }
}

interface ITestExprVisitor { visitTest(expr: TestExpression); }
function TestExprVisitor(Base: new(state: IVisitorState) => IVisitor) {
  return class extends Base {
    public visitTest(expr: TestExpression) {
      this.passResult(new TestTranslator(expr.value));
    }
  };
}

class TestTranslator implements IExpressionTranslator {
  constructor(private value: string) {}

  public getPropertyTree() { return new ScopedPropertyTree(); }
  public toSparqlFilterClause(): string { return this.value; }
}

class TestBinaryExpression<TVisitor> {
  public accept(v: TVisitor) { throw new Error("not implemented"); }
  public getLhs() { return new TestExpression("LHS"); }
  public getRhs() { return new TestExpression("RHS"); }
}
