"use strict";
var odataQueryEngine = require("../src/adapter/query_engine");
var sparqlProviderModule = require("../src/sparql/sparql_provider");
var rdfstore = require("rdfstore");
describe("The query engine should evaluate", function () {
    createQuerySpec("/Posts", function (answer) {
        var result = answer.result;
        expectSuccess(answer);
        expect(result.length).toBe(2);
        expect(result[0].Id).toBe("1");
        expect(result[1].Id).toBe("2");
    });
    createQuerySpec("/Posts?$expand=Content", function (answer) {
        var result = answer.result;
        expectSuccess(answer);
        expect(result).toEqual([
            {
                Id: "1",
                ContentId: "1",
                ParentId: null,
                Content: {
                    Id: "1",
                    Title: "Post Nr. 1",
                },
            },
            {
                Id: "2",
                ContentId: "2",
                ParentId: "1",
                Content: {
                    Id: "2",
                    Title: "Post Nr. 2",
                },
            },
        ]);
    });
    createQuerySpec("/Posts?$expand=Parent", function (answer) {
        var result = answer.result;
        expectSuccess(answer);
        expect(result).toEqual([
            {
                Id: "1",
                ContentId: "1",
                ParentId: null,
                Parent: null,
            },
            {
                Id: "2",
                ContentId: "2",
                ParentId: "1",
                Parent: {
                    Id: "1",
                    ContentId: "1",
                    ParentId: null,
                },
            },
        ]);
    });
    createQuerySpec("/Posts?$expand=Children", function (answer) {
        var result = answer.result;
        expectSuccess(answer);
        expect(result).toEqual([
            {
                Id: "1",
                ContentId: "1",
                ParentId: null,
                Children: [
                    {
                        Id: "2",
                        ContentId: "2",
                        ParentId: "1",
                    },
                ],
            },
            {
                Id: "2",
                ContentId: "2",
                ParentId: "1",
                Children: [],
            },
        ]);
    });
    createQuerySpec("/Posts?$expand=Children/Parent", function (answer) {
        var result = answer.result;
        expectSuccess(answer);
        expect(result).toEqual([
            {
                Id: "1",
                ContentId: "1",
                ParentId: null,
                Children: [
                    {
                        Id: "2",
                        ContentId: "2",
                        ParentId: "1",
                        Parent: {
                            Id: "1",
                            ContentId: "1",
                            ParentId: null,
                        },
                    },
                ],
            },
            {
                Id: "2",
                ContentId: "2",
                ParentId: "1",
                Children: [],
            },
        ]);
    });
    createQuerySpec("/Posts?$filter='0' eq '1'", function (answer) {
        expectSuccess(answer);
        expect(answer.result.length).toBe(0);
    });
    createQuerySpec("/Posts?$filter=Id eq '1'", function (answer) {
        expectSuccess(answer);
        expect(answer.result.length).toBe(1);
    });
    createQuerySpec("/Posts?$filter=Id eq '0'", function (answer) {
        expectSuccess(answer);
        expect(answer.result.length).toBe(0);
    });
    createQuerySpec("/Posts?$filter=(Id eq '1')", function (answer) {
        expectSuccess(answer);
        expect(answer.result.length).toBe(1);
    });
    function createQuerySpec(query, cb, pending) {
        if (pending === void 0) { pending = false; }
        var fn = pending ? xit : it;
        fn(query, function (done) {
            rdfstore.create(function (error, store) {
                var graphName = "http://example.org/";
                storeSeed(store, graphName, function () {
                    var sparqlProvider = new sparqlProviderModule.SparqlProvider(store, graphName);
                    var engine = new odataQueryEngine.QueryEngine();
                    engine.setSparqlProvider(sparqlProvider);
                    try {
                        engine.query(query, function (results) {
                            cb(results);
                            done();
                        });
                    }
                    catch (e) {
                        expect(e).toBe("no exception");
                        done();
                    }
                });
            });
        });
    }
});
function expectSuccess(answer) {
    expect(answer.error).toBeUndefined();
    expect(answer.result).toBeDefined();
}
function storeSeed(store, graphName, cb) {
    store.rdf.setPrefix("rdf", "http://www.w3.org/1999/02/22-rdf-syntax-ns#");
    store.rdf.setPrefix("disco", "http://disco-network.org/resource/");
    var graph = store.rdf.createGraph();
    var node = createNamedNode.bind(store);
    var literal = createLiteral.bind(store);
    graph.add(store.rdf.createTriple(node("disco:post1"), node("rdf:type"), node("disco:Post")));
    graph.add(store.rdf.createTriple(node("disco:post1"), node("disco:id"), literal("1")));
    graph.add(store.rdf.createTriple(node("disco:post1"), node("disco:content"), node("disco:content1")));
    graph.add(store.rdf.createTriple(node("disco:post2"), node("rdf:type"), node("disco:Post")));
    graph.add(store.rdf.createTriple(node("disco:post2"), node("disco:id"), literal("2")));
    graph.add(store.rdf.createTriple(node("disco:post2"), node("disco:content"), node("disco:content2")));
    graph.add(store.rdf.createTriple(node("disco:post2"), node("disco:parent"), node("disco:post1")));
    graph.add(store.rdf.createTriple(node("disco:content1"), node("disco:id"), literal("1")));
    graph.add(store.rdf.createTriple(node("disco:content1"), node("disco:title"), literal("Post Nr. 1")));
    graph.add(store.rdf.createTriple(node("disco:content2"), node("disco:id"), literal("2")));
    graph.add(store.rdf.createTriple(node("disco:content2"), node("disco:title"), literal("Post Nr. 2")));
    store.insert(graph, graphName, cb);
}
function createNamedNode(str) {
    return this.rdf.createNamedNode(this.rdf.resolve(str));
}
function createLiteral(str) {
    return this.rdf.createLiteral(str);
}

//# sourceMappingURL=../../maps/spec/integrationtest_query_spec.js.map
