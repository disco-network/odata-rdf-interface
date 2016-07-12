"use strict";
var gpatterns = require("../src/adapter/sparql_graphpatterns");
var qbuilder = require("../src/adapter/querystring_builder");
describe("the query string builder", function () {
    it("should build queries without UNION and OPTIONAL", function () {
        var pattern = new gpatterns.TreeGraphPattern("?root");
        pattern.branch("disco:id", new gpatterns.ValueLeaf("1"));
        pattern.branch("disco:refersTo", "?ref").branch("disco:referree", new gpatterns.ValueLeaf("2"));
        var builder = new qbuilder.QueryStringBuilder();
        var queryString = builder.buildGraphPatternString(pattern);
        expect(queryString).toEqual("{ ?root disco:id \"1\" . " +
            "?root disco:refersTo ?ref . ?ref disco:referree \"2\" }");
    });
    it("should build queries with UNION", function () {
        var pattern = new gpatterns.TreeGraphPattern("?root");
        pattern.branch("disco:id", new gpatterns.ValueLeaf("1"));
        pattern.newUnionPattern().branch("disco:parent", "?parent");
        pattern.newUnionPattern().inverseBranch("disco:parent", "?child");
        var builder = new qbuilder.QueryStringBuilder();
        var queryString = builder.buildGraphPatternString(pattern);
        expect(queryString).toEqual("{ ?root disco:id \"1\" . " +
            "{ ?root disco:parent ?parent } UNION { ?child disco:parent ?root } }");
    });
    it("should build queries with nested UNIONs", function () {
        var pattern = new gpatterns.TreeGraphPattern("?root");
        pattern.newUnionPattern().newUnionPattern().branch("disco:id", new gpatterns.ValueLeaf("1"));
        var builder = new qbuilder.QueryStringBuilder();
        var queryString = builder.buildGraphPatternString(pattern);
        expect(queryString).toEqual("{ { { ?root disco:id \"1\" } } }");
    });
    it("should build unions of branches", function () {
        var pattern = new gpatterns.TreeGraphPattern("?root");
        pattern.branch("disco:content", "?cnt").newUnionPattern().branch("disco:id", "?id");
        var builder = new qbuilder.QueryStringBuilder();
        var queryString = builder.buildGraphPatternString(pattern);
        expect(queryString).toEqual("{ ?root disco:content ?cnt . { ?cnt disco:id ?id } }");
    });
    it("should build queries with OPTIONAL", function () {
        var pattern = new gpatterns.TreeGraphPattern("?root");
        pattern.optionalBranch("disco:parent", "?par").branch("disco:id", "?id");
        var builder = new qbuilder.QueryStringBuilder();
        var queryString = builder.buildGraphPatternString(pattern);
        expect(queryString).toEqual("{ OPTIONAL { ?root disco:parent ?par . ?par disco:id ?id } }");
    });
});

//# sourceMappingURL=../../maps/spec/build_querystring_spec.js.map
