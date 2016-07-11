"use strict";
var connect = require("connect");
var fs = require("fs");
var abnfTokenizer = require("abnfjs/tokenizer");
var abnfParser = require("abnfjs/parser");
var abnfInterpreter = require("abnfjs/interpreter");
var ast2query = require("./odata/ast2query");
var schema = require("./odata/schema");
var sparqlQueries = require("./adapter/queries_sparql");
var queries = require("./odata/queries");
var providerModule = require("./sparql/sparql_provider");
var rdfstore = require("rdfstore");
var config = {
    port: 52999,
    path: "/",
};
var schm = new schema.Schema();
var abnf = fs.readFileSync("./src/odata/odata4-mod.abnf", "utf8");
var tokens = abnfTokenizer.tokenize(abnf);
var grammar = abnfParser.parse(tokens);
var interpreter = new abnfInterpreter.Interpreter(grammar);
var store = null;
var provider;
var storeName = "http://datokrat.sirius.uberspace.de/disco-test";
var app = connect();
app.use(config.path, function (req, res, next) {
    // TODO: check if something important changes when config.path != '/'
    var url = req.url.substr(1);
    var ast = interpreter.getCompleteMatch(interpreter.getPattern("odataRelativeUri"), url);
    var queryModel = ast2query.getQueryModelFromEvaluatedAst(ast.evaluate(), schm.raw);
    var query = (new sparqlQueries.QueryFactory(queryModel, schm)).create();
    query.run(provider, function (result) {
        sendResults(res, result);
    });
});
/**
 * Pass the results of the query to the HTTP result object
 */
function sendResults(res, result) {
    if (!result.error) {
        res.writeHeader(200, { "Content-type": "application/json" });
        res.end(JSON.stringify(result.result, null, 2));
    }
    else {
        handleErrors(this.result, res);
    }
}
function handleErrors(result, res) {
    switch (result.error) {
        case queries.ErrorTypes.DB:
            res.statusCode = 500;
            res.end("database error " + result.errorDetails);
            break;
        default:
            res.statusCode = 500;
            console.log(result.error.stack);
            res.end("unknown error type " + result.error);
    }
}
rdfstore.create(function (error, st) {
    store = st;
    storeSeed(function (err) {
        if (err)
            console.error("seed failed", err);
        else
            startServer();
    });
});
function storeSeed(cb) {
    store.rdf.setPrefix("rdf", "http://www.w3.org/1999/02/22-rdf-syntax-ns#");
    store.rdf.setPrefix("rdfs", "http://www.w3.org/2000/01/rdf-schema#");
    store.rdf.setPrefix("disco", "http://disco-network.org/resource/");
    var graph = store.rdf.createGraph();
    graph.add(store.rdf.createTriple(store.rdf.createNamedNode(store.rdf.resolve("disco:post1")), store.rdf.createNamedNode(store.rdf.resolve("rdf:type")), store.rdf.createNamedNode(store.rdf.resolve("disco:Post"))));
    graph.add(store.rdf.createTriple(store.rdf.createNamedNode(store.rdf.resolve("disco:post1")), store.rdf.createNamedNode(store.rdf.resolve("disco:id")), store.rdf.createLiteral("1") // TODO: TYPE
    ));
    graph.add(store.rdf.createTriple(store.rdf.createNamedNode(store.rdf.resolve("disco:post1")), store.rdf.createNamedNode(store.rdf.resolve("disco:content")), store.rdf.createNamedNode(store.rdf.resolve("disco:post1")) // TODO: TYPE
    ));
    graph.add(store.rdf.createTriple(store.rdf.createNamedNode(store.rdf.resolve("disco:post1")), store.rdf.createNamedNode(store.rdf.resolve("disco:parent")), store.rdf.createLiteral("null") // TODO: MAKE OPTIONAL
    ));
    store.insert(graph, storeName, cb);
}
function startServer() {
    provider = new providerModule.SparqlProvider(store, storeName);
    app.listen(config.port);
    console.log("server is listening on port " + config.port);
}

//# sourceMappingURL=../../maps/src/server.js.map
