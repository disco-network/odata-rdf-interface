"use strict";
var odataQueryEngine = require("../src/adapter/query_engine");
var sparqlProviderModule = require("../src/sparql/sparql_provider");
var rdfstore = require("rdfstore");
describe("The query engine should evaluate", function () {
    function createQuerySpec(query, cb) {
        it(query, function (done) {
            rdfstore.create(function (error, store) {
                var graphName = "http://example.org/";
                storeSeed(store, graphName, function () {
                    var sparqlProvider = new sparqlProviderModule.SparqlProvider(store, graphName);
                    var engine = new odataQueryEngine.QueryEngine();
                    engine.setSparqlProvider(sparqlProvider);
                    engine.query(query, function (results) {
                        cb(results);
                        done();
                    });
                });
            });
        });
    }
    createQuerySpec("/Posts", function (answer) {
        var result = answer.result;
        expectSuccess(answer);
        expect(result.length).toBe(1);
        expect(result[0].Id).toBe("1");
    });
    createQuerySpec("/Posts?$expand=Content", function (answer) {
        var result = answer.result;
        expectSuccess(answer);
        expect(result).toEqual([
            {
                Id: "1",
                ContentId: "1",
                Content: {
                    Id: "1",
                    ContentId: "1",
                },
            },
        ]);
    });
    createQuerySpec("/Posts?$expand=Content/Content", function (answer) {
        var result = answer.result;
        expectSuccess(answer);
        expect(result).toEqual([
            {
                Id: "1",
                ContentId: "1",
                Content: {
                    Id: "1",
                    ContentId: "1",
                    Content: {
                        Id: "1",
                        ContentId: "1",
                    },
                },
            },
        ]);
    });
});
function expectSuccess(answer) {
    expect(answer.error).toBeUndefined();
    expect(answer.result).toBeDefined();
}
function storeSeed(store, graphName, cb) {
    store.rdf.setPrefix("rdf", "http://www.w3.org/1999/02/22-rdf-syntax-ns#");
    store.rdf.setPrefix("disco", "http://disco-network.org/resource/");
    var graph = store.rdf.createGraph();
    graph.add(store.rdf.createTriple(store.rdf.createNamedNode(store.rdf.resolve("disco:post1")), store.rdf.createNamedNode(store.rdf.resolve("rdf:type")), store.rdf.createNamedNode(store.rdf.resolve("disco:Post"))));
    graph.add(store.rdf.createTriple(store.rdf.createNamedNode(store.rdf.resolve("disco:post1")), store.rdf.createNamedNode(store.rdf.resolve("disco:id")), store.rdf.createLiteral("1")));
    graph.add(store.rdf.createTriple(store.rdf.createNamedNode(store.rdf.resolve("disco:post1")), store.rdf.createNamedNode(store.rdf.resolve("disco:content")), store.rdf.createNamedNode(store.rdf.resolve("disco:post1"))));
    graph.add(store.rdf.createTriple(store.rdf.createNamedNode(store.rdf.resolve("disco:post1")), store.rdf.createNamedNode(store.rdf.resolve("disco:parent")), store.rdf.createLiteral("null")));
    store.insert(graph, graphName, cb);
}

//# sourceMappingURL=../maps/spec/integrationtest_query_spec.js.map
