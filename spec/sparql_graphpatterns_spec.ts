import { assert } from "chai";

import schemaModule = require("../src/odata/schema");
let schema = new schemaModule.Schema();
import gpatterns = require("../src/sparql/graphpatterns");
import propertyTreeConfiguration = require("../src/bootstrap/adapter/propertytree");
import mhelper = require("./helpers/sparql_mappings");

describe("tree graph patterns", function() {
  it("should build a consistent tree", function() {
    let gp = new gpatterns.TreeGraphPattern("?root");

    gp.branch("disco:id", "?id");

    assert.strictEqual(gp.branchExists("disco:id"), true);
    assert.strictEqual(gp.branchExists("disco:content"), false);
    assert.strictEqual(gp.branch("disco:id")[0].name(), "?id");
  });
  it("should generate triples", function() {
    let gp = new gpatterns.TreeGraphPattern("?root");

    gp.branch("disco:id", "?id");
    gp.branch("disco:content", "?cnt").branch("disco:id", "?cntid");

    assert.includeDeepMembers(gp.getDirectTriples(), [[ "?root", "disco:id", "?id" ]]);
    assert.includeDeepMembers(gp.getDirectTriples(), [[ "?root", "disco:content", "?cnt" ]]);
    assert.includeDeepMembers(gp.branch("disco:content")[0].getDirectTriples(), [[ "?cnt", "disco:id", "?cntid" ]]);
  });
  it("should allow value leaves", function() {
    let gp = new gpatterns.TreeGraphPattern("?root");
    gp.branch("disco:id", new gpatterns.ValueLeaf("1"));

    assert.includeDeepMembers(gp.getDirectTriples(), [[ "?root", "disco:id", "\"1\""]]);
  });
  it("should allow optional branches", function() {
    let gp = new gpatterns.TreeGraphPattern("?root");

    gp.optionalBranch("disco:id", "?id");

    assert.includeDeepMembers(gp.getOptionalPatterns()[0].getDirectTriples(), [[ "?root", "disco:id", "?id" ]]);
  });
  it("should allow me to integrate other trees as branches", function() {
    let gp = new gpatterns.TreeGraphPattern("?root");
    let inner = new gpatterns.TreeGraphPattern("?inner");

    inner.branch("disco:id", "?id");
    gp.branch("disco:inner", inner);

    assert.deepEqual(gp.branch("disco:inner")[0], inner);
  });
  it("should allow me to integrate other trees as optional branches", function() {
    let gp = new gpatterns.TreeGraphPattern("?root");
    let inner = new gpatterns.TreeGraphPattern("?inner");

    inner.branch("disco:id", "?id");
    gp.optionalBranch("disco:inner", inner);

    assert.includeDeepMembers(gp.getOptionalPatterns()[0].getDirectTriples(), [[ "?root", "disco:inner", "?inner" ]]);
    assert.deepEqual(gp.getOptionalPatterns()[0].branch("disco:inner")[0], inner);
  });
  it("should allow me to merge with other trees", function() {
    let gp = new gpatterns.TreeGraphPattern("?root");
    let other = new gpatterns.TreeGraphPattern("?root");

    other.branch("disco:id", "?id");
    gp.merge(other);

    assert.includeDeepMembers(gp.getDirectTriples(), [[ "?root", "disco:id", "?id" ]]);
  });
  it("should not allow me to merge with trees with different roots", function() {
    let gp = new gpatterns.TreeGraphPattern("?root");
    let other = new gpatterns.TreeGraphPattern("?other");

    other.branch("disco:id", "?id");
    assert.throws(() => gp.merge(other));
  });
  it("should detect and handle collisions when merging", function() {
    let gp = new gpatterns.TreeGraphPattern("?root");
    let gp2 = new gpatterns.TreeGraphPattern("?root");

    gp.branch("id", "?id");
    gp2.branch("id", "?id2");
    gp.merge(gp2);

    assert.strictEqual(gp.branch("id").length, 2);
  });
  it("should allow UNION branches", function() {
    let gp = new gpatterns.TreeGraphPattern("?root");
    let union1 = new gpatterns.TreeGraphPattern("?u1");
    let union2 = new gpatterns.TreeGraphPattern("?u2");

    let upat = gp.newUnionPattern();
    upat.branch("id", union1);
    upat.branch("id", union2);

    assert.strictEqual(gp.getUnionPatterns().length, 1);
    assert.strictEqual(gp.getUnionPatterns().length, 1);
    assert.strictEqual(gp.getUnionPatterns()[0].branch("id").length, 2);
  });
  xit("should have inverse branches", function() {
    let gp = new gpatterns.TreeGraphPattern("?root");
    gp.inverseBranch("disco:parent", "?child");
  });
});

describe("direct property pattern strategies", function() {
  xit("should store the direct properties in the mapping", function() {
    let mapping = mhelper.createStructuredMapping();
    // xit expandTreePatterns.DirectPropertiesGraphPatternFactory.create(schema.getEntityType("Post"), mapping, "");

    assert.strictEqual(mapping.elementaryPropertyExists("Id"), true);
    assert.strictEqual(mapping.elementaryPropertyExists("ParentId"), true);
    assert.strictEqual(mapping.elementaryPropertyExists("ContentId"), true);
    assert.strictEqual(mapping.elementaryPropertyExists("Parent"), false);
    assert.strictEqual(mapping.elementaryPropertyExists("Content"), false);
  });
  xit("should create the triples corresponding to the direct properties", function() {
    /*let mapping = mhelper.createStructuredMapping("?post");
    let gp = expandTreePatterns.DirectPropertiesGraphPatternFactory.create(schema.getEntityType("Post"), mapping, "");

    expect(gp.getDirectTriples()).toContain([ "?post", "disco:id", mapping.getElementaryPropertyVariable("Id") ]);*/
  });
  xit("should create the triples corresponding to the mirrored direct properties", function() {
    /*let mapping = mhelper.createStructuredMapping("?post");
    let gp = expandTreePatterns.DirectPropertiesGraphPatternFactory.create(schema.getEntityType("Post"), mapping, "");

    expect(gp.getDirectTriples()).toContain(
      [ "?post", "disco:content", mapping.getComplexProperty("Content").getVariable() ]);
    expect(gp.branch("disco:content")[0].getDirectTriples()).toContain(
      [ mapping.getComplexProperty("Content").getVariable(), "disco:id",
      mapping.getElementaryPropertyVariable("ContentId") ]);*/
  });
  xit("should create optional triples", function() {
    /*let mapping = mhelper.createStructuredMapping("?post");
    let gp = expandTreePatterns.DirectPropertiesGraphPatternFactory.create(schema.getEntityType("Post"), mapping, "");

    expect(gp.getOptionalPatterns()[0].getDirectTriples()).toContain(
      [ "?post", "disco:parent", mapping.getComplexProperty("Parent").getVariable() ]);*/
  });
});

describe("complex-property expand pattern strategy", function() {
  it("should expand the first depth level", function() {
    let expandTree = { Content: {} };
    let mapping = mhelper.createStructuredMapping("?post");
    let gp = createExpandPatternStrategy().create(schema.getEntityType("Post"), expandTree, mapping);

    assert.strictEqual(mapping.getComplexProperty("Content").elementaryPropertyExists("Id"), true);
    assert.strictEqual(gp.getUnionPatterns().length, 1);
    assert.includeDeepMembers(gp.getUnionPatterns()[0].getDirectTriples(),
      [[ "?post", "disco:content", mapping.getComplexProperty("Content").getVariable() ]]);
    assert.includeDeepMembers(gp.getUnionPatterns()[0].branch("disco:content")[1].getDirectTriples(),
      [[ mapping.getComplexProperty("Content").getVariable(), "disco:id",
      mapping.getComplexProperty("Content").getElementaryPropertyVariable("Id") ]]);
    assert.includeDeepMembers(gp.getDirectTriples(),
      [[ "?post", "disco:id", mapping.getElementaryPropertyVariable("Id") ]]);
  });
  it("should expand the second depth level", function() {
    let expandTree = { Content: { Culture: {} } };
    let mapping = mhelper.createStructuredMapping("?post");
    createExpandPatternStrategy().create(schema.getEntityType("Post"), expandTree, mapping);

    assert.strictEqual(mapping.getComplexProperty("Content").getComplexProperty("Culture")
    .elementaryPropertyExists("Id"), true);
  });
  it("should expand the optional properties of the first depth level", function() {
    let expandTree = { Parent: {} };
    let mapping = mhelper.createStructuredMapping("?post");
    let gp = createExpandPatternStrategy().create(schema.getEntityType("Post"), expandTree, mapping);

    assert.strictEqual(mapping.getComplexProperty("Parent").elementaryPropertyExists("Id"), true);
    assert.includeDeepMembers(gp.getUnionPatterns()[0].optionalBranch("disco:parent")[1].getDirectTriples(),
      [[ mapping.getComplexProperty("Parent").getVariable(), "disco:id",
        mapping.getComplexProperty("Parent").getElementaryPropertyVariable("Id") ]]);
  });
});

describe("A filter graph pattern", () => {
  xit("should expand elementary properties of the first depth level", () => {
    /*let expandTree = filters.ScopedPropertyTree.fromDataObjects({ Id: {} });
    let mapping = mhelper.createMapping(schema.getEntityType("Post"), "?post");
    let filterContext: filters.FilterContext = {
      mapping: mapping,
      entityType: schema.getEntityType("Post"),
      lambdaVariableScope: new filters.LambdaVariableScope(),
    };
    let gp = filterPatterns.FilterGraphPatternFactory.createFromPropertyTree(filterContext, expandTree);

    expect(mapping.variables.elementaryPropertyExists("Id")).toEqual(true);
    expect(gp.getUnionPatterns().length).toEqual(0);
    expect(gp.getOptionalPatterns().length).toEqual(1);
    expect(gp.getOptionalPatterns()[0].getDirectTriples()).toEqual(
      [[ "?post", "disco:id", mapping.variables.getElementaryPropertyVariable("Id") ]]
    );*/
  });
  xit("should work in a lambda environment", () => {
    /*let expandTree = filters.ScopedPropertyTree.fromDataObjects({ Id: {} }, { it: { Id: {} } });
    let mapping = mhelper.createMapping(schema.getEntityType("Post"), "?post");
    let filterContext: filters.FilterContext = {
      mapping: mapping,
      entityType: schema.getEntityType("Post"),
      lambdaVariableScope: new filters.LambdaVariableScope().add({
          variable: "it",
          entityType: schema.getEntityType("Post"),
      }),
    };
    let filterPattern = filterPatterns.FilterGraphPatternFactory.createFromPropertyTree(filterContext, expandTree);

    expect(filterPattern.getConjunctivePatterns().length).toBe(1);
    expect(filterPattern.getConjunctivePatterns()[0].getOptionalPatterns()[0].name())
      .toBe(mapping.variables.getLambdaNamespace("it").getVariable());
    expect(filterPattern.getConjunctivePatterns()[0].getOptionalPatterns()[0].branch("disco:id")[0].name())
      .toBe(mapping.variables.getLambdaNamespace("it").getElementaryPropertyVariable("Id"));*/
  });
});

function createExpandPatternStrategy() {
  return propertyTreeConfiguration.getExpandTreeGraphPatternStrategy();
}
