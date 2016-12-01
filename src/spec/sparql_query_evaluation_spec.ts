import { assert } from "chai";
import { JsonResultBuilder } from "../lib/adapter/odatarepository";

import { Schema } from "../lib/odata/schema";
import { nestedSchema } from "./helpers/schemata";
let schema = new Schema();
import queryAdapter = require("../lib/adapter/odatarepository");
import mhelper = require("./helpers/sparql_mappings");

const serviceUri = "http://ex.org/odata";

describe("Adapter.SparqlQueryContext", function () {
  it("should recognize and enumerate over elementary properties", function () {
    let mapping = mhelper.createStructuredMapping("?post");
    let queryContext = new queryAdapter.QueryContext(mapping, schema.getEntityType("Post"), {});

    let idVar = mapping.getElementaryPropertyVariable("Id");
    let answer = {};
    answer[idVar.substr(1)] = { token: "literal", value: "5" };

    let ok = false;
    queryContext.forEachElementaryPropertyOfResult(answer, function () { ok = true; });

    assert.strictEqual(ok, true);
  });
  it("should return me a subcontext and recognize its elementary properties", function () {
    let mapping = mhelper.createStructuredMapping("?post");
    let queryContext = new queryAdapter.QueryContext(mapping, schema.getEntityType("Post"), { Parent: {} });

    let idVar = mapping.getComplexProperty("Parent").getElementaryPropertyVariable("Id");
    let answer = {};
    answer[idVar.substr(1)] = { token: "literal", value: "5" };

    let ok = false;
    queryContext.getSubContext("Parent").forEachElementaryPropertyOfResult(answer, function () { ok = true; });

    assert.strictEqual(ok, true);
  });
});

describe("match evaluator", function () {
  it("should evaluate elem. and complex properties", function () {
    let mapping = mhelper.createStructuredMapping("?post");
    let queryContext = new queryAdapter.QueryContext(mapping, schema.getEntityType("Post"), { Parent: {} });
    let evaluator = new JsonResultBuilder(serviceUri);

    let idVar = mapping.getElementaryPropertyVariable("Id");
    let parentIdVar = mapping.getComplexProperty("Parent").getElementaryPropertyVariable("Id");

    let responses = [{}];
    responses[0][parentIdVar.substr(1)] = { token: "literal", value: "5" };
    responses[0][idVar.substr(1)] = { token: "literal", value: "1" };
    let results = evaluator.run(responses, queryContext);

    assert.isUndefined(results[0].Content);
    assert.strictEqual(results[0].Id, "1");
    assert.strictEqual(results[0].Parent.Id, "5");
  });
  it("should only include complex properties which are in the expand tree", function () {
    let mapping = mhelper.createStructuredMapping("?post");
    let queryContext = new queryAdapter.QueryContext(mapping, schema.getEntityType("Post"), {});
    let resultBuilder = new JsonResultBuilder(serviceUri);

    let idVar = mapping.getElementaryPropertyVariable("Id");
    let parentIdVar = mapping.getComplexProperty("Parent").getElementaryPropertyVariable("Id");

    let responses = [{}];
    responses[0][idVar.substr(1)] = { token: "literal", value: "1" };
    responses[0][parentIdVar.substr(1)] = { token: "literal", value: "5" };
    let results = resultBuilder.run(responses, queryContext);

    assert.isUndefined(results[0].Parent);
  });
  it("should include complex properties of quantity one", function () {
    let mapping = mhelper.createStructuredMapping("?post");
    let queryContext = new queryAdapter.QueryContext(mapping, schema.getEntityType("Post"), { Content: {} });
    let evaluator = new JsonResultBuilder(serviceUri);

    let idVar = mapping.getElementaryPropertyVariable("Id");
    let contentIdVar = mapping.getComplexProperty("Content").getElementaryPropertyVariable("Id");

    let responses = [{}, {}];
    responses[0][idVar.substr(1)] = { token: "literal", value: "1" };
    responses[1][idVar.substr(1)] = { token: "literal", value: "1" };
    responses[1][contentIdVar.substr(1)] = { token: "literal", value: "2" };
    let results = evaluator.run(responses, queryContext);

    assert.strictEqual(results.length, 1);
    assert.strictEqual(results[0].Id, "1");
    assert.strictEqual(results[0].Content.Id, "2");
  });
  it("should support expand trees of depth two", function () {
    let mapping = mhelper.createStructuredMapping("?post");
    let queryContext = new queryAdapter.QueryContext(mapping, schema.getEntityType("Post"),
      { Content: { Culture: {} } });
    let evaluator = new JsonResultBuilder(serviceUri);

    let idVar = mapping.getElementaryPropertyVariable("Id");
    let cidVar = mapping.getComplexProperty("Content").getElementaryPropertyVariable("Id");
    let ccidVar = mapping.getComplexProperty("Content").getComplexProperty("Culture")
      .getElementaryPropertyVariable("Id");

    let responses = [{}, {}];
    let [response1, response2] = responses;
    response1[idVar.substr(1)] = response2[idVar.substr(1)] = makeLiteral("1");
    response1[cidVar.substr(1)] = response2[cidVar.substr(1)] = makeLiteral("2");
    response2[ccidVar.substr(1)] = makeLiteral("3");
    let results = evaluator.run(responses, queryContext);

    assert.strictEqual(results.length, 1);
  });
  it("should expand properties of types different from the root type", () => {
    const mapping = mhelper.createStructuredMapping("?post");
    const queryContext = new queryAdapter.QueryContext(mapping, nestedSchema.getEntityType("Human"),
      { Head: {} });
    const evaluator = new JsonResultBuilder(serviceUri);

    const idVar = mapping.getElementaryPropertyVariable("Id");
    const hIdVar = mapping.getComplexProperty("Head").getElementaryPropertyVariable("Id");
    const hEyeVar = mapping.getComplexProperty("Head").getElementaryPropertyVariable("EyeColor");

    const responses = [{}];
    const [response1] = responses;
    response1[idVar.substr(1)] = makeLiteral("1");
    response1[hIdVar.substr(1)] = makeLiteral("2");
    response1[hEyeVar.substr(1)] = makeLiteral("green");
    const results = evaluator.run(responses, queryContext);

    assert.deepPropertyVal(results[0], "Id", "1");
    assert.deepPropertyVal(results[0], "Head.Id", "2");
    assert.deepPropertyVal(results[0], "Head.EyeColor", "green");

  });
  it("should set unbound elementary properties to null", function () {
    /* @todo should this only apply to optional props? */
    let mapping = mhelper.createStructuredMapping("?post");
    let queryContext = new queryAdapter.QueryContext(mapping, schema.getEntityType("Post"), {});
    let evaluator = new JsonResultBuilder(serviceUri);

    let idVar = mapping.getElementaryPropertyVariable("Id");
    let cidVar = mapping.getComplexProperty("Content").getElementaryPropertyVariable("Id");

    let response = {};
    response[idVar.substr(1)] = makeLiteral("1");
    response[cidVar.substr(1)] = makeLiteral("2");
    let results = evaluator.run([response], queryContext);

    assert.strictEqual(results.length, 1);
    assert.deepPropertyVal(results[0], "ParentId", null);
  });
});

function makeLiteral(value) {
  return { token: "literal", value: value };
}
