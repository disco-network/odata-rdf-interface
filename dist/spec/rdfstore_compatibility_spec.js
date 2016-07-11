"use strict";
var rdfstore = require("rdfstore");
describe("rdfstore should execute", function () {
    createSpec("SELECT * WHERE { ?s rdf:type disco:Post }", function (answer) {
        expect(answer.error).toBe(null);
        expect(answer.result.length).toBeGreaterThan(0);
    });
    createSpec("SELECT * WHERE { ?s rdf:type disco:Post FILTER EXISTS { ?s disco:id '1'  } }", function (answer) {
        expect(answer.error).toBe(null);
        expect(answer.result.length).toBe(1);
    });
    createSpec("SELECT * WHERE { ?s rdf:type disco:Post . ?s disco:id ?id FILTER(?id = '1') }", function (answer) {
        expect(answer.error).toBe(null);
        expect(answer.result.length).toBe(1);
    });
    createSpec("SELECT * WHERE { ?s rdf:type disco:Post FILTER(EXISTS { ?s disco:id '1' }) }", function (answer) {
        expect(answer.error).toBe(null);
        expect(answer.result.length).toBe(1);
    });
    createSpec("SELECT * WHERE { ?s rdf:type disco:Post . ?s disco:id ?id "
        + "FILTER(?id = '1' && EXISTS { ?s disco:content ?cnt . ?cnt disco:id '1' }) }", function (answer) {
        expect(answer.error).toBe(null);
        expect(answer.result.length).toBe(1);
    });
    createSpec("SELECT * WHERE { ?s rdf:type disco:Post . ?s disco:id ?id "
        + "FILTER(?id = '2' || EXISTS { ?s disco:content ?cnt . ?cnt disco:id '1' }) }", function (answer) {
        expect(answer.error).toBe(null);
        expect(answer.result.length).toBe(2);
    });
    function createSpec(query, cb) {
        var prefixes = "PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> ";
        prefixes += "PREFIX disco: <http://disco-network.org/resource/> ";
        it(query, function (done) {
            rdfstore.create(function (error, store) {
                var graphName = "http://example.org";
                storeSeed(store, graphName, function () {
                    store.executeWithEnvironment(prefixes + query, [graphName], [], function (err, results) {
                        cb({ error: err, result: results });
                        done();
                    });
                });
            });
        });
    }
});
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

//# sourceMappingURL=../../maps/spec/rdfstore_compatibility_spec.js.map
