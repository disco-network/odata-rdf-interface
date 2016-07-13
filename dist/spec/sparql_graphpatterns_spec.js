"use strict";
var SchemaModule = require("../src/odata/schema");
var schema = new SchemaModule.Schema();
var gpatterns = require("../src/adapter/sparql_graphpatterns");
var mhelper = require("./helpers/sparql_mappings");
describe("tree graph patterns", function () {
    it("should build a consistent tree", function () {
        var gp = new gpatterns.TreeGraphPattern("?root");
        gp.branch("disco:id", "?id");
        expect(gp.branchExists("disco:id")).toEqual(true);
        expect(gp.branchExists("disco:content")).toEqual(false);
        expect(gp.branch("disco:id")[0].name()).toEqual("?id");
    });
    it("should generate triples", function () {
        var gp = new gpatterns.TreeGraphPattern("?root");
        gp.branch("disco:id", "?id");
        gp.branch("disco:content", "?cnt").branch("disco:id", "?cntid");
        expect(gp.getDirectTriples()).toContain(["?root", "disco:id", "?id"]);
        expect(gp.getDirectTriples()).toContain(["?root", "disco:content", "?cnt"]);
        expect(gp.branch("disco:content")[0].getDirectTriples()).toContain(["?cnt", "disco:id", "?cntid"]);
    });
    it("should allow value leaves", function () {
        var gp = new gpatterns.TreeGraphPattern("?root");
        gp.branch("disco:id", new gpatterns.ValueLeaf("1"));
        expect(gp.getDirectTriples()).toContain(["?root", "disco:id", "\"1\""]);
    });
    it("should allow optional branches", function () {
        var gp = new gpatterns.TreeGraphPattern("?root");
        gp.optionalBranch("disco:id", "?id");
        expect(gp.getOptionalPatterns()[0].getDirectTriples()).toContain(["?root", "disco:id", "?id"]);
    });
    it("should allow me to integrate other trees as branches", function () {
        var gp = new gpatterns.TreeGraphPattern("?root");
        var inner = new gpatterns.TreeGraphPattern("?inner");
        inner.branch("disco:id", "?id");
        gp.branch("disco:inner", inner);
        expect(gp.branch("disco:inner")[0]).toEqual(inner);
    });
    it("should allow me to integrate other trees as optional branches", function () {
        var gp = new gpatterns.TreeGraphPattern("?root");
        var inner = new gpatterns.TreeGraphPattern("?inner");
        inner.branch("disco:id", "?id");
        gp.optionalBranch("disco:inner", inner);
        expect(gp.getOptionalPatterns()[0].getDirectTriples()).toContain(["?root", "disco:inner", "?inner"]);
        expect(gp.getOptionalPatterns()[0].branch("disco:inner")[0]).toEqual(inner);
    });
    it("should allow me to merge with other trees", function () {
        var gp = new gpatterns.TreeGraphPattern("?root");
        var other = new gpatterns.TreeGraphPattern("?root");
        other.branch("disco:id", "?id");
        gp.merge(other);
        expect(gp.getDirectTriples()).toContain(["?root", "disco:id", "?id"]);
    });
    it("should not allow me to merge with trees with different roots", function () {
        var gp = new gpatterns.TreeGraphPattern("?root");
        var other = new gpatterns.TreeGraphPattern("?other");
        other.branch("disco:id", "?id");
        expect(function () { gp.merge(other); }).toThrow();
    });
    it("should detect and handle collisions when merging", function () {
        var gp = new gpatterns.TreeGraphPattern("?root");
        var gp2 = new gpatterns.TreeGraphPattern("?root");
        gp.branch("id", "?id");
        gp2.branch("id", "?id2");
        gp.merge(gp2);
        expect(gp.branch("id").length).toEqual(2);
    });
    it("should allow UNION branches", function () {
        var gp = new gpatterns.TreeGraphPattern("?root");
        var union1 = new gpatterns.TreeGraphPattern("?u1");
        var union2 = new gpatterns.TreeGraphPattern("?u2");
        var upat = gp.newUnionPattern();
        upat.branch("id", union1);
        upat.branch("id", union2);
        expect(gp.getUnionPatterns().length).toEqual(1);
        expect(gp.getUnionPatterns().length).toEqual(1);
        expect(gp.getUnionPatterns()[0].branch("id").length).toEqual(2);
    });
    it("should have inverse branches", function () {
        var gp = new gpatterns.TreeGraphPattern("?root");
        gp.inverseBranch("disco:parent", "?child");
    });
});
describe("direct property graph patterns", function () {
    it("should store the direct properties in the mapping", function () {
        var mapping = mhelper.createStructuredMapping();
        new gpatterns.DirectPropertiesGraphPattern(schema.getEntityType("Post"), mapping, "");
        expect(mapping.elementaryPropertyExists("Id")).toEqual(true);
        expect(mapping.elementaryPropertyExists("ParentId")).toEqual(true);
        expect(mapping.elementaryPropertyExists("ContentId")).toEqual(true);
        expect(mapping.elementaryPropertyExists("Parent")).toEqual(false);
        expect(mapping.elementaryPropertyExists("Content")).toEqual(false);
    });
    it("should create the triples corresponding to the direct properties", function () {
        var mapping = mhelper.createStructuredMapping("?post");
        var gp = new gpatterns.DirectPropertiesGraphPattern(schema.getEntityType("Post"), mapping, "");
        expect(gp.getDirectTriples()).toContain(["?post", "disco:id", mapping.getElementaryPropertyVariable("Id")]);
    });
    it("should create the triples corresponding to the mirrored direct properties", function () {
        var mapping = mhelper.createStructuredMapping("?post");
        var gp = new gpatterns.DirectPropertiesGraphPattern(schema.getEntityType("Post"), mapping, "");
        expect(gp.getDirectTriples()).toContain(["?post", "disco:content", mapping.getComplexProperty("Content").getVariable()]);
        expect(gp.branch("disco:content")[0].getDirectTriples()).toContain([mapping.getComplexProperty("Content").getVariable(), "disco:id",
            mapping.getElementaryPropertyVariable("ContentId")]);
    });
    it("should create optional triples", function () {
        var mapping = mhelper.createStructuredMapping("?post");
        var gp = new gpatterns.DirectPropertiesGraphPattern(schema.getEntityType("Post"), mapping, "");
        expect(gp.getOptionalPatterns()[0].getDirectTriples()).toContain(["?post", "disco:parent", mapping.getComplexProperty("Parent").getVariable()]);
    });
});
describe("expand tree graph patterns", function () {
    it("should expand the first depth level", function () {
        var expandTree = { Content: {} };
        var mapping = mhelper.createStructuredMapping("?post");
        var gp = new gpatterns.ExpandTreeGraphPattern(schema.getEntityType("Post"), expandTree, mapping);
        expect(mapping.getComplexProperty("Content").elementaryPropertyExists("Id")).toEqual(true);
        expect(gp.getUnionPatterns().length).toEqual(2);
        expect(gp.getUnionPatterns()[0].getDirectTriples()).toContain(["?post", "disco:content", mapping.getComplexProperty("Content").getVariable()]);
        expect(gp.getUnionPatterns()[1].branch("disco:content")[0].getDirectTriples())
            .toContain([mapping.getComplexProperty("Content").getVariable(), "disco:id",
            mapping.getComplexProperty("Content").getElementaryPropertyVariable("Id")]);
        /* OLD: expect(gp.getUnionPatterns()[1].branch("disco:content")[0].getUnionPatterns()[0].getTriples())
        .toContain([ mapping.getComplexProperty("Content").getVariable(), "disco:id",
          mapping.getComplexProperty("Content").getElementaryPropertyVariable("Id") ]);*/
        expect(gp.getDirectTriples()).toContain(["?post", "disco:id", mapping.getElementaryPropertyVariable("Id")]);
    });
    it("should expand the second depth level", function () {
        var expandTree = { Content: { Culture: {} } };
        var mapping = mhelper.createStructuredMapping("?post");
        new gpatterns.ExpandTreeGraphPattern(schema.getEntityType("Post"), expandTree, mapping);
        expect(mapping.getComplexProperty("Content").getComplexProperty("Culture")
            .elementaryPropertyExists("Id")).toEqual(true);
    });
    it("should expand the optional properties of the first depth level", function () {
        var expandTree = { Parent: {} };
        var mapping = mhelper.createStructuredMapping("?post");
        var gp = new gpatterns.ExpandTreeGraphPattern(schema.getEntityType("Post"), expandTree, mapping);
        expect(mapping.getComplexProperty("Parent").elementaryPropertyExists("Id")).toEqual(true);
        expect(gp.getUnionPatterns()[1].branch("disco:parent")[0].getDirectTriples()).toContain([mapping.getComplexProperty("Parent").getVariable(), "disco:id",
            mapping.getComplexProperty("Parent").getElementaryPropertyVariable("Id")]);
    });
});

//# sourceMappingURL=../../maps/spec/sparql_graphpatterns_spec.js.map