import helper = require("./helpers/sparql_mappings");
import mappings = require("../src/adapter/mappings");
import schemaModule = require("../src/odata/schema");
let schema = new schemaModule.Schema();

describe("unstructured odata to sparql mappings", function() {
  it("should not exist entries until they were accessed", function() {
    let mapping = helper.createUnstructuredMapping();

    expect(mapping.mappingExists("Id")).toEqual(false);
    mapping.getPropertyVariable("Id");
    expect(mapping.mappingExists("Id")).toEqual(true);
  });

  it("should call the first variable ?x0", function() {
    let mapping = helper.createUnstructuredMapping();
    let first = mapping.getPropertyVariable("Id");

    expect(first).toEqual("?x0");
  });

  it("should always return the same variable name for the same entry", function() {
    let mapping = helper.createUnstructuredMapping();
    let first = mapping.getPropertyVariable("Id");
    let second = mapping.getPropertyVariable("Id");

    expect(first).toEqual(second);
  });

  it("should always return a different variable name for different entries", function() {
    let mapping = helper.createUnstructuredMapping();
    let a = mapping.getPropertyVariable("A");
    let b = mapping.getPropertyVariable("B");

    expect(a).not.toEqual(b);
  });
});

describe("structured odata to sparql mappings", function() {
  it("should return the specified root variable name", function() {
    let mapping = helper.createStructuredMapping("?root");
    let variable = mapping.getVariable();

    expect(variable).toEqual("?root");
  });

  it("should call the first elementary property variable ?x0", function() {
    let mapping = helper.createStructuredMapping("?root");
    let variable = mapping.getElementaryPropertyVariable("Id");

    expect(variable).toEqual("?x0");
  });

  it("should call the first complex property variable ?x0", function() {
    let mapping = helper.createStructuredMapping("?root");
    let variable = mapping.getComplexProperty("Content").getVariable();

    expect(variable).toEqual("?x0");
  });

  it("should nest the mappings using complex properties", function() {
    let mapping = helper.createStructuredMapping("?root");
    let contentContentId1 = mapping.getComplexProperty("Content").getComplexProperty("Content")
      .getElementaryPropertyVariable("Id");
    let contentContentId2 = mapping.getComplexProperty("Content").getComplexProperty("Content")
      .getElementaryPropertyVariable("Id");
    let id = mapping.getElementaryPropertyVariable("Id");

    expect(contentContentId1).toEqual(contentContentId2);
    expect(contentContentId1).not.toEqual(id);
  });

  it("should not exist elementary properties until they were accessed", function() {
    let mapping = helper.createStructuredMapping("?root");

    expect(mapping.elementaryPropertyExists("Id")).toEqual(false);
    mapping.getElementaryPropertyVariable("Id");
    expect(mapping.elementaryPropertyExists("Id")).toEqual(true);
  });
});

describe("property mappings", () => {
  /* @todo */
});

describe("scoped mappings", () => {
  it("should work", () => {
    let mapping = helper.createScopedMapping(schema.getEntityType("Post"), "?root");

    let id = new mappings.UniqueScopeIdentifier("any");
    expect(mapping.scope(id).unscoped() === mapping.unscoped());
    expect(() => mapping.getNamespace("it")).toThrow();
  });

  it("should access namespaces of parents", () => {
    let mapping = helper.createScopedMapping(schema.getEntityType("Post"), "?root");
    let scopeId = new mappings.UniqueScopeIdentifier("any");

    mapping.setNamespace("it", schema.getEntityType("Post"));

    expect(mapping.scope(scopeId).getNamespace("it")).toBeDefined();
  });
});
