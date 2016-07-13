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
    let evaluator = new queries.JsonResultBuilder();

    let idVar = mapping.getElementaryPropertyVariable("Id");
    let parentIdVar = mapping.getComplexProperty("Parent").getElementaryPropertyVariable("Id");

    let responses = [{}];
    responses[0][parentIdVar.substr(1)] = { token: "literal", value: "5" };
    responses[0][idVar.substr(1)] = { token: "literal", value: "1" };
    let results = evaluator.run(responses, queryContext);

    expect(results[0].Content).toBeUndefined();
    expect(results[0].Id).toEqual("1");
    expect(results[0].Parent.Id).toEqual("5");
  });
  it("should only include complex properties which are in the expand tree", function() {
    let mapping = mhelper.createStructuredMapping("?post");
    let queryContext = new squeries.SparqlQueryContext(mapping, schema.getEntityType("Post"), {});
    let resultBuilder = new queries.JsonResultBuilder();

    let idVar = mapping.getElementaryPropertyVariable("Id");
    let parentIdVar = mapping.getComplexProperty("Parent").getElementaryPropertyVariable("Id");

    let responses = [{}];
    responses[0][idVar.substr(1)] = { token: "literal", value: "1" };
    responses[0][parentIdVar.substr(1)] = { token: "literal", value: "5" };
    let results = resultBuilder.run(responses, queryContext);

    expect(results[0].Parent).toBeUndefined();
  });
  it("should include complex properties of quantity one", function() {
    let mapping = mhelper.createStructuredMapping("?post");
    let queryContext = new squeries.SparqlQueryContext(mapping, schema.getEntityType("Post"), { Content: {} });
    let evaluator = new queries.JsonResultBuilder();

    let idVar = mapping.getElementaryPropertyVariable("Id");
    let contentIdVar = mapping.getComplexProperty("Content").getElementaryPropertyVariable("Id");

    let responses = [{}, {}];
    responses[0][idVar.substr(1)] = { token: "literal", value: "1" };
    responses[1][idVar.substr(1)] = { token: "literal", value: "1" };
    responses[1][contentIdVar.substr(1)] = { token: "literal", value: "2" };
    let results = evaluator.run(responses, queryContext);

    expect(results.length).toEqual(1);
    expect(results[0].Id).toEqual("1");
    expect(results[0].Content.Id).toEqual("2");
  });
  it("should support expand trees of depth two", function() {
    let mapping = mhelper.createStructuredMapping("?post");
    let queryContext = new squeries.SparqlQueryContext(mapping, schema.getEntityType("Post"),
      { Content: { Culture: {} } });
    let evaluator = new queries.JsonResultBuilder();

    let idVar = mapping.getElementaryPropertyVariable("Id");
    let cidVar = mapping.getComplexProperty("Content").getElementaryPropertyVariable("Id");
    let ccidVar = mapping.getComplexProperty("Content").getComplexProperty("Culture")
      .getElementaryPropertyVariable("Id");

    let responses = [{}, {}];
    let [ response1, response2 ] = responses;
    response1[idVar.substr(1)] = response2[idVar.substr(1)] = makeLiteral("1");
    response1[cidVar.substr(1)] = response2[cidVar.substr(1)] = makeLiteral("2");
    response2[ccidVar.substr(1)] = makeLiteral("3");
    let results = evaluator.run(responses, queryContext);

    expect(results.length).toEqual(1);
  });
  it("should set unbound elementary properties to null", function() {
    /* @todo should this only apply to optional props? */
    let mapping = mhelper.createStructuredMapping("?post");
    let queryContext = new squeries.SparqlQueryContext(mapping, schema.getEntityType("Post"), {});
    let evaluator = new queries.JsonResultBuilder();

    let idVar = mapping.getElementaryPropertyVariable("Id");
    let cidVar = mapping.getElementaryPropertyVariable("ContentId");

    let response = {};
    response[idVar.substr(1)] = makeLiteral("1");
    response[cidVar.substr(1)] = makeLiteral("2");
    let results = evaluator.run([response], queryContext);

    expect(results.length).toBe(1);
    expect(results[0]).toEqual({
      Id: "1", ContentId: "2", ParentId: null,
    });
  });
});

function makeLiteral(value) {
  return { token: "literal", value: value };
}
