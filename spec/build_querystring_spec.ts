import gpatterns = require("../src/adapter/sparql_graphpatterns");
import qbuilder = require("../src/adapter/querystring_builder");

describe("the query string builder", function() {
  it("should build queries without UNION and OPTIONAL", function() {
    let pattern = new gpatterns.TreeGraphPattern("?root");
    pattern.branch("disco:id", new gpatterns.ValueLeaf("1"));
    pattern.branch("disco:refersTo", "?ref").branch("disco:referree", new gpatterns.ValueLeaf("2"));

    let builder = new qbuilder.QueryStringBuilder();
    let queryString = builder.buildGraphPatternString(pattern);

    expect(queryString).toEqual(
      "{ ?root disco:id \"1\" . " +
      "?root disco:refersTo ?ref . ?ref disco:referree \"2\" }");
  });
  it("should build queries with UNION", function() {
    let pattern = new gpatterns.TreeGraphPattern("?root");
    pattern.branch("disco:id", new gpatterns.ValueLeaf("1"));
    pattern.newUnionPattern().branch("disco:parent", "?parent");
    pattern.newUnionPattern().inverseBranch("disco:parent", "?child");

    let builder = new qbuilder.QueryStringBuilder();
    let queryString = builder.buildGraphPatternString(pattern);

    expect(queryString).toEqual(
      "{ ?root disco:id \"1\" . " +
      "{ ?root disco:parent ?parent } UNION { ?child disco:parent ?root } }"
    );
  });
});
