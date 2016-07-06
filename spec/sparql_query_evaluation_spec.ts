import SchemaModule = require("../src/odata/schema");
let schema = new SchemaModule.Schema();
import squeries = require("../src/adapter/queries_sparql");
import queries = require("../src/odata/queries");
import mhelper = require("./helpers/sparql_mappings");

describe("query context", function() {
  it("should recognize and enumerate over elementary properties", function() {
    let mapping = mhelper.createStructuredMapping("?post");
    let queryContext = new squeries.SparqlQueryContext(mapping, schema.getEntityType("Post"), { });

    let idVar = mapping.getElementaryPropertyVariable("Id");
    let answer = { };
    answer[idVar.substr(1)] = { token: "literal", value: "5" };

    let ok = false;
    queryContext.forEachElementaryPropertyOfResult(answer, function() { ok = true; });

    expect(ok).toEqual(true);
  });
  it("should return me a subcontext and recognize its elementary properties", function() {
    let mapping = mhelper.createStructuredMapping("?post");
    let queryContext = new squeries.SparqlQueryContext(mapping, schema.getEntityType("Post"), { Parent: {} });

    let idVar = mapping.getComplexProperty("Parent").getElementaryPropertyVariable("Id");
    let answer = { };
    answer[idVar.substr(1)] = { token: "literal", value: "5" };

    let ok = false;
    queryContext.getSubContext("Parent").forEachElementaryPropertyOfResult(answer, function() { ok = true; });

    expect(ok).toEqual(true);
  });
});

describe("match evaluator", function() {
  it("should evaluate elem. and complex properties", function() {
    let mapping = mhelper.createStructuredMapping("?post");
    let queryContext = new squeries.SparqlQueryContext(mapping, schema.getEntityType("Post"), { Parent: {} });
    let evaluator = new queries.QueryResultEvaluator();

    let idVar = mapping.getElementaryPropertyVariable("Id");
    let parentVar = mapping.getComplexProperty("Parent").getVariable();
    let parentIdVar = mapping.getComplexProperty("Parent").getElementaryPropertyVariable("Id");

    let responses = [{}];
    responses[0][parentVar.substr(1)] = { token: "uri", value: "http://example.org/5" };
    responses[0][parentIdVar.substr(1)] = { token: "literal", value: "5" };
    responses[0][idVar.substr(1)] = { token: "literal", value: "1" };
    let results = evaluator.evaluate(responses, queryContext);

    expect(results[0].Content).toBeUndefined();
    expect(results[0].Id).toEqual("1");
    expect(results[0].Parent.Id).toEqual("5");
  });
  it("should only include complex properties which are in the expand tree", function() {
    let mapping = mhelper.createStructuredMapping("?post");
    let queryContext = new squeries.SparqlQueryContext(mapping, schema.getEntityType("Post"), {});
    let evaluator = new queries.QueryResultEvaluator();

    let parentIdVar = mapping.getComplexProperty("Parent").getElementaryPropertyVariable("Id");

    let responses = [{}];
    responses[0][parentIdVar.substr(1)] = { token: "literal", value: "5" };
    let results = evaluator.evaluate(responses, queryContext);

    expect(results[0].Parent).toBeUndefined();
  });
  it("should include complex properties of quantity one", function() {
    let mapping = mhelper.createStructuredMapping("?post");
    let queryContext = new squeries.SparqlQueryContext(mapping, schema.getEntityType("Post"), { Content: {} });
    let evaluator = new queries.QueryResultEvaluator();

    let idVar = mapping.getElementaryPropertyVariable("Id");
    let contentVar = mapping.getComplexProperty("Content").getVariable();
    let contentIdVar = mapping.getComplexProperty("Content").getElementaryPropertyVariable("Id");

    let responses = [{}, {}];
    responses[0][idVar.substr(1)] = { token: "literal", value: "1" };
    responses[1][idVar.substr(1)] = { token: "literal", value: "1" };
    responses[1][contentVar.substr(1)] = { token: "uri", value: "http://example.org/2" };
    responses[1][contentIdVar.substr(1)] = { token: "literal", value: "2" };
    let results = evaluator.evaluate(responses, queryContext);

    expect(results.length).toEqual(1);
    expect(results[0].Id).toEqual("1");
    expect(results[0].Content.Id).toEqual("2");
  });
});
