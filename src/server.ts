import connect = require("connect");
import fs = require("fs");

import abnfTokenizer = require("abnfjs/tokenizer");
import abnfParser = require("abnfjs/parser");
import abnfInterpreter = require("abnfjs/interpreter");

import ast2query = require("./odata/ast2query");
import schema = require("./odata/schema");

import sparqlQueries = require("./adapter/queries_sparql");

import providerModule = require("./sparql/sparql_provider");

import rdfstore = require("rdfstore");

let config = {
  port: 52999,
  path: "/",
};

let schm = new schema.Schema();

let abnf = fs.readFileSync("./src/odata/odata4-mod.abnf", "utf8");
let tokens = abnfTokenizer.tokenize(abnf);
let grammar = abnfParser.parse(tokens);
let interpreter = new abnfInterpreter.Interpreter(grammar);

let store = null;
let provider;
let storeName = "http://datokrat.sirius.uberspace.de/disco-test";

let app = connect();

app.use(config.path, function(req, res, next) {
	// TODO: check if something important changes when config.path != '/'
  let url = req.url.substr(1);

  let ast = interpreter.getCompleteMatch(interpreter.getPattern("odataRelativeUri"), url);
  let queryModel = ast2query.getQueryModelFromEvaluatedAst(ast.evaluate(), schm.raw);
  let query = (new sparqlQueries.QueryFactory(queryModel, schm)).create();

  query.run(provider, function() {
    query.sendResults(res);
  });
});

rdfstore.create(function(error, st) {
  store = st;
  storeSeed(function(err) {
    if (err) console.error("seed failed", err);
    else startServer();
  });
});

function storeSeed(cb) {
  store.rdf.setPrefix("rdf", "http://www.w3.org/1999/02/22-rdf-syntax-ns#");
  store.rdf.setPrefix("rdfs", "http://www.w3.org/2000/01/rdf-schema#");
  store.rdf.setPrefix("disco", "http://disco-network.org/resource/");

  let graph = store.rdf.createGraph();
  graph.add(store.rdf.createTriple(
    store.rdf.createNamedNode(store.rdf.resolve("disco:post1")),
    store.rdf.createNamedNode(store.rdf.resolve("rdf:type")),
    store.rdf.createNamedNode(store.rdf.resolve("disco:Post"))
  ));
  graph.add(store.rdf.createTriple(
    store.rdf.createNamedNode(store.rdf.resolve("disco:post1")),
    store.rdf.createNamedNode(store.rdf.resolve("disco:id")),
    store.rdf.createLiteral("1") // TODO: TYPE
  ));
  graph.add(store.rdf.createTriple(
    store.rdf.createNamedNode(store.rdf.resolve("disco:post1")),
    store.rdf.createNamedNode(store.rdf.resolve("disco:content")),
    store.rdf.createNamedNode(store.rdf.resolve("disco:post1")) // TODO: TYPE
  ));
  graph.add(store.rdf.createTriple(
    store.rdf.createNamedNode(store.rdf.resolve("disco:post1")),
    store.rdf.createNamedNode(store.rdf.resolve("disco:parent")),
    store.rdf.createLiteral("null") // TODO: MAKE OPTIONAL
  ));

  store.insert(graph, storeName, cb);
}

function startServer() {
  provider = new providerModule.SparqlProvider(store, storeName);
  app.listen(config.port);
  console.log("server is listening on port " + config.port);
}
