import { assert } from "chai";

import gpatterns = require("../src/sparql/graphpatterns");
import qbuilder = require("../src/sparql/querystringbuilder");

describe("the graph pattern string builder", function() {
  it("should build queries without UNION and OPTIONAL", function() {
    let pattern = new gpatterns.TreeGraphPattern("?root");
    pattern.branch("disco:id", new gpatterns.ValueLeaf("1"));
    pattern.branch("disco:refersTo", "?ref").branch("disco:referree", new gpatterns.ValueLeaf("2"));

    let builder = new qbuilder.GraphPatternStringBuilder();
    let queryString = builder.buildGraphPatternString(pattern);

    assert.strictEqual(queryString,
      "{ ?root disco:id \"1\" . " +
      "?root disco:refersTo ?ref . ?ref disco:referree \"2\" }");
  });
  it("should build queries with UNION", function() {
    let pattern = new gpatterns.TreeGraphPattern("?root");
    pattern.branch("disco:id", new gpatterns.ValueLeaf("1"));
    pattern.newUnionPattern().branch("disco:parent", "?parent");
    pattern.newUnionPattern().inverseBranch("disco:parent", "?child");

    let builder = new qbuilder.GraphPatternStringBuilder();
    let queryString = builder.buildGraphPatternString(pattern);

    assert.strictEqual(queryString,
      "{ ?root disco:id \"1\" " +
      "{ ?root disco:parent ?parent } UNION { ?child disco:parent ?root } }"
    );
  });
  it("should build queries with nested UNIONs", function() {
    let pattern = new gpatterns.TreeGraphPattern("?root");
    pattern.newUnionPattern().newUnionPattern().branch("disco:id", new gpatterns.ValueLeaf("1"));

    let builder = new qbuilder.GraphPatternStringBuilder();
    let queryString = builder.buildGraphPatternString(pattern);

    assert.strictEqual(queryString,
      "{ { { ?root disco:id \"1\" } } }"
    );
  });
  it("should build unions of branches", function() {
    let pattern = new gpatterns.TreeGraphPattern("?root");
    pattern.branch("disco:content", "?cnt").newUnionPattern().branch("disco:id", "?id");

    let builder = new qbuilder.GraphPatternStringBuilder();
    let queryString = builder.buildGraphPatternString(pattern);

    assert.strictEqual(queryString,
      "{ ?root disco:content ?cnt . { ?cnt disco:id ?id } }"
    );
  });
  it("should build queries with OPTIONAL", function() {
    let pattern = new gpatterns.TreeGraphPattern("?root");
    pattern.optionalBranch("disco:parent", "?par").branch("disco:id", "?id");

    let builder = new qbuilder.GraphPatternStringBuilder();
    let queryString = builder.buildGraphPatternString(pattern);

    assert.strictEqual(queryString,
      "{ OPTIONAL { ?root disco:parent ?par . ?par disco:id ?id } }"
    );
  });
  it("should build queries with conjunctive patterns", () => {
    let pattern = new gpatterns.TreeGraphPattern("?rootA");
    pattern.newConjunctivePattern(new gpatterns.TreeGraphPattern("?rootB")).branch("disco:id", "?id");

    let builder = new qbuilder.GraphPatternStringBuilder();
    let queryString = builder.buildGraphPatternString(pattern);

    assert.strictEqual(queryString,
      "{ { ?rootB disco:id ?id } }"
    );
  });

  it("should amend FILTER expressions after empty patterns", () => {
    let pattern = new gpatterns.TreeGraphPattern("?root");

    let builder = new qbuilder.GraphPatternStringBuilder();
    let query = builder.buildGraphPatternStringAmendFilterExpression
      (pattern, { toSparqlFilterClause: () => "{filter}" });

    assert.strictEqual(query, "{ FILTER({filter}) }");
  });

  it("should amend FILTER expressions after patterns", () => {
    let pattern = new gpatterns.TreeGraphPattern("{subject}");
    pattern.branch("{predicate}", "{object}");

    let builder = new qbuilder.GraphPatternStringBuilder();
    let query = builder.buildGraphPatternStringAmendFilterExpression
      (pattern, { toSparqlFilterClause: () => "{filter}" });

    assert.strictEqual(query, "{ {subject} {predicate} {object} . FILTER({filter}) }");
  });
});

describe("SelectSkeletonBuilder:", () => {
  it("build a query skeleton without prefixes", () => {
    let builder = new qbuilder.SelectSkeletonBuilder();

    let query = builder.buildSkeleton("", "{graphPattern}");

    assert.strictEqual(query, "SELECT * WHERE {graphPattern}");
  });

  it("build a query skeleton with prefixes", () => {
    let builder = new qbuilder.SelectSkeletonBuilder();

    let query = builder.buildSkeleton("{prefixes}", "{graphPattern}");

    assert.strictEqual(query, "{prefixes} SELECT * WHERE {graphPattern}");
  });
});

describe("SelectQueryStringBuilder:", () => {
  let pattern1 = new gpatterns.TreeGraphPattern("?root");
  spec("no prefix, no filter", {
    prefixes: [], pattern: pattern1, filter: undefined, prefixString: "", patternString: "{  }",
    queryString: "SELECT WHERE {  }",
  });

  let pattern2 = new gpatterns.TreeGraphPattern("?root");
  spec("with 1 prefix, no filter", {
    prefixes: [{ prefix: "pre", uri: "pre://fi.x" }], pattern: pattern2, filter: undefined,
      prefixString: "PREFIX pre: <pre://fi.x>", patternString: "{  }", queryString: "SELECT WHERE {  }",
  });

  let pattern3 = new gpatterns.TreeGraphPattern("?root");
  spec("with 2 prefix, no filter", {
    prefixes: [{ prefix: "pre", uri: "pre://fi.x" }, { prefix: "ex", uri: "ex" }], pattern: pattern3, filter: undefined,
      prefixString: "PREFIX pre: <pre://fi.x> PREFIX ex: <ex>", patternString: "{  }", queryString: "SELECT WHERE {  }",
  });

  function spec(name: string, args: {
    prefixes: qbuilder.IPrefix[]; pattern: gpatterns.TreeGraphPattern; filter: qbuilder.IFilterExpression;
    patternString: string; prefixString: string; queryString: string
  }) {
    it(name, () => {
      let patternBuilder = new GraphPatternStringBuilder();
      patternBuilder.buildGraphPatternStringAmendFilterExpression = (pat, filter?) => {
        assert.strictEqual(pat, args.pattern);
        assert.strictEqual(filter, args.filter);
        return args.patternString;
      };
      let skeletonBuilder = new SelectSkeletonBuilder();
      skeletonBuilder.buildSkeleton = (prefixes, pat) => {
        assert.strictEqual(prefixes, args.prefixString);
        assert.strictEqual(pat, args.patternString);
        return args.queryString;
      };
      let prefixBuilder = new PrefixBuilder();
      prefixBuilder.prefixesAsSparql = prefixes => {
        return args.prefixString;
      };
      let builder = new qbuilder.SelectQueryStringBuilder(prefixBuilder, skeletonBuilder, patternBuilder);

      let query = builder.fromGraphPatternAndFilterExpression(args.prefixes, args.pattern, args.filter);

      assert.strictEqual(query, args.queryString);
    });
  }
});

describe("InsertQueryStringBuilder:", () => {
  it("should produce [PREFIXES] INSERT DATA { GRAPH <[GRAPH]> { <test> ns:prop '1' } }",
  () => {
    const prefixes = [{ prefix: "ns", uri: "http://ns.a/" }];
    const properties = [{ rdfProperty: "ns:prop", value: { representAsSparql: () => "'1'"} }];
    const prefixProducer = new PrefixBuilder();
    prefixProducer.prefixesAsSparql = p => {
      assert.deepEqual(p, prefixes);
      return "[PREFIXES]";
    };
    const producer = new qbuilder.InsertQueryStringBuilder(prefixProducer, "[GRAPH]");

    const sparql = producer.insertAsSparql(prefixes, "test", properties);
    assert.strictEqual(sparql, "[PREFIXES] INSERT DATA { GRAPH <[GRAPH]> { <test> ns:prop '1' } }");
  });
});

class SelectSkeletonBuilder implements qbuilder.ISelectSkeletonBuilder {
  public buildSkeleton(prefixes: string, graphPattern: string): any {
    //
  }
}

class GraphPatternStringBuilder implements qbuilder.IGraphPatternStringBuilder {
  public buildGraphPatternString(pattern: gpatterns.TreeGraphPattern): any {
    return this.buildGraphPatternStringAmendFilterExpression(pattern);
  }

  public buildGraphPatternStringAmendFilterExpression(pattern: gpatterns.TreeGraphPattern,
                                                      filter?: qbuilder.IFilterExpression): any {
    //
  }
}

class PrefixBuilder implements qbuilder.IPrefixBuilder {
  public prefixesAsSparql(prefixes: qbuilder.IPrefix[]): any {
    //
  }
}
