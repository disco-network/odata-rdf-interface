import { assert } from "chai";

import helper = require("./helpers/sparql_mappings");
import mappings = require("../src/adapter/mappings");
import schemaModule = require("../src/odata/schema");
let schema = new schemaModule.Schema();

describe("unstructured odata to sparql mappings", function() {
  it("should not exist entries until they were accessed", function() {
    let mapping = helper.createUnstructuredMapping();

    assert.strictEqual(mapping.mappingExists("Id"), false);
    mapping.getPropertyVariable("Id");
    assert.strictEqual(mapping.mappingExists("Id"), true);
  });

  it("should call the first variable ?x0", function() {
    let mapping = helper.createUnstructuredMapping();
    let first = mapping.getPropertyVariable("Id");

    assert.strictEqual(first, "?x0");
  });

  it("should always return the same variable name for the same entry", function() {
    let mapping = helper.createUnstructuredMapping();
    let first = mapping.getPropertyVariable("Id");
    let second = mapping.getPropertyVariable("Id");

    assert.strictEqual(first, second);
  });

  it("should always return a different variable name for different entries", function() {
    let mapping = helper.createUnstructuredMapping();
    let a = mapping.getPropertyVariable("A");
    let b = mapping.getPropertyVariable("B");

    assert.notStrictEqual(a, b);
  });
});

describe("structured odata to sparql mappings", function() {
  it("should return the specified root variable name", function() {
    let mapping = helper.createStructuredMapping("?root");
    let variable = mapping.getVariable();

    assert.strictEqual(variable, "?root");
  });

  it("should call the first elementary property variable ?x0", function() {
    let mapping = helper.createStructuredMapping("?root");
    let variable = mapping.getElementaryPropertyVariable("Id");

    assert.strictEqual(variable, "?x0");
  });

  it("should call the first complex property variable ?x0", function() {
    let mapping = helper.createStructuredMapping("?root");
    let variable = mapping.getComplexProperty("Content").getVariable();

    assert.strictEqual(variable, "?x0");
  });

  it("should nest the mappings using complex properties", function() {
    let mapping = helper.createStructuredMapping("?root");
    let contentContentId1 = mapping.getComplexProperty("Content").getComplexProperty("Content")
      .getElementaryPropertyVariable("Id");
    let contentContentId2 = mapping.getComplexProperty("Content").getComplexProperty("Content")
      .getElementaryPropertyVariable("Id");
    let id = mapping.getElementaryPropertyVariable("Id");

    assert.strictEqual(contentContentId1, contentContentId2);
    assert.notStrictEqual(contentContentId1, id);
  });

  it("should not exist elementary properties until they were accessed", function() {
    let mapping = helper.createStructuredMapping("?root");

    assert.strictEqual(mapping.elementaryPropertyExists("Id"), false);
    mapping.getElementaryPropertyVariable("Id");
    assert.strictEqual(mapping.elementaryPropertyExists("Id"), true);
  });
});

describe("property mappings", () => {
  /* @todo */
});

describe("scoped mappings", () => {
  it("should work", () => {
    let mapping = helper.createScopedMapping(schema.getEntityType("Post"), "?root");

    let id = new mappings.UniqueScopeIdentifier("any");
    assert.strictEqual(mapping.scope(id).unscoped(), mapping.unscoped());
    assert.throws(() => mapping.getNamespace("it"));
  });

  it("should access namespaces of parents", () => {
    let mapping = helper.createScopedMapping(schema.getEntityType("Post"), "?root");
    let scopeId = new mappings.UniqueScopeIdentifier("any");

    mapping.setNamespace("it", schema.getEntityType("Post"));

    assert.isDefined(mapping.scope(scopeId).getNamespace("it"));
  });
});
