"use strict";
var SchemaModule = require("../src/odata/schema");
var schema = new SchemaModule.Schema();
var squeries = require("../src/adapter/queries_sparql");
var queries = require("../src/odata/queries");
var mhelper = require("./helpers/sparql_mappings");
describe("query context", function () {
    it("should recognize and enumerate over elementary properties", function () {
        var mapping = mhelper.createStructuredMapping("?post");
        var queryContext = new squeries.SparqlQueryContext(mapping, schema.getEntityType("Post"), {});
        var idVar = mapping.getElementaryPropertyVariable("Id");
        var answer = {};
        answer[idVar.substr(1)] = { token: "literal", value: "5" };
        var ok = false;
        queryContext.forEachElementaryPropertyOfResult(answer, function () { ok = true; });
        expect(ok).toEqual(true);
    });
    it("should return me a subcontext and recognize its elementary properties", function () {
        var mapping = mhelper.createStructuredMapping("?post");
        var queryContext = new squeries.SparqlQueryContext(mapping, schema.getEntityType("Post"), { Parent: {} });
        var idVar = mapping.getComplexProperty("Parent").getElementaryPropertyVariable("Id");
        var answer = {};
        answer[idVar.substr(1)] = { token: "literal", value: "5" };
        var ok = false;
        queryContext.getSubContext("Parent").forEachElementaryPropertyOfResult(answer, function () { ok = true; });
        expect(ok).toEqual(true);
    });
});
describe("match evaluator", function () {
    it("should evaluate elem. and complex properties", function () {
        var mapping = mhelper.createStructuredMapping("?post");
        var queryContext = new squeries.SparqlQueryContext(mapping, schema.getEntityType("Post"), { Parent: {} });
        var evaluator = new queries.QueryResultEvaluator();
        var idVar = mapping.getElementaryPropertyVariable("Id");
        var parentVar = mapping.getComplexProperty("Parent").getVariable();
        var parentIdVar = mapping.getComplexProperty("Parent").getElementaryPropertyVariable("Id");
        var responses = [{}];
        responses[0][parentVar.substr(1)] = { token: "uri", value: "http://example.org/5" };
        responses[0][parentIdVar.substr(1)] = { token: "literal", value: "5" };
        responses[0][idVar.substr(1)] = { token: "literal", value: "1" };
        var results = evaluator.evaluate(responses, queryContext);
        expect(results[0].Content).toBeUndefined();
        expect(results[0].Id).toEqual("1");
        expect(results[0].Parent.Id).toEqual("5");
    });
    it("should only include complex properties which are in the expand tree", function () {
        var mapping = mhelper.createStructuredMapping("?post");
        var queryContext = new squeries.SparqlQueryContext(mapping, schema.getEntityType("Post"), {});
        var evaluator = new queries.QueryResultEvaluator();
        var parentIdVar = mapping.getComplexProperty("Parent").getElementaryPropertyVariable("Id");
        var responses = [{}];
        responses[0][parentIdVar.substr(1)] = { token: "literal", value: "5" };
        var results = evaluator.evaluate(responses, queryContext);
        expect(results[0].Parent).toBeUndefined();
    });
    it("should include complex properties of quantity one", function () {
        var mapping = mhelper.createStructuredMapping("?post");
        var queryContext = new squeries.SparqlQueryContext(mapping, schema.getEntityType("Post"), { Content: {} });
        var evaluator = new queries.QueryResultEvaluator();
        var idVar = mapping.getElementaryPropertyVariable("Id");
        var contentVar = mapping.getComplexProperty("Content").getVariable();
        var contentIdVar = mapping.getComplexProperty("Content").getElementaryPropertyVariable("Id");
        var responses = [{}, {}];
        responses[0][idVar.substr(1)] = { token: "literal", value: "1" };
        responses[1][idVar.substr(1)] = { token: "literal", value: "1" };
        responses[1][contentVar.substr(1)] = { token: "uri", value: "http://example.org/2" };
        responses[1][contentIdVar.substr(1)] = { token: "literal", value: "2" };
        var results = evaluator.evaluate(responses, queryContext);
        expect(results.length).toEqual(1);
        expect(results[0].Id).toEqual("1");
        expect(results[0].Content.Id).toEqual("2");
    });
});

//# sourceMappingURL=../maps/spec/sparql_query_evaluation_spec.js.map
