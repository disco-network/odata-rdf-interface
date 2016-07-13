import connect = require("connect");
import fs = require("fs");

import abnfTokenizer = require("abnfjs/tokenizer");
import abnfParser = require("abnfjs/parser");
import abnfInterpreter = require("abnfjs/interpreter");

import ast2query = require("./odata/ast2query");
import schema = require("./odata/schema");

import sparqlQueries = require("./adapter/queries_sparql");
import queries = require("./odata/queries");

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

  query.run(provider, result => {
    sendResults(res, result);
  });
});

/**
 * Pass the results of the query to the HTTP result object
 */
function sendResults(res, result): void {
  if (!result.error) {
    res.writeHeader(200, { "Content-type": "application/json" });
    res.end(JSON.stringify(result.result, null, 2));
  }
  else {
    handleErrors(this.result, res);
  }
}
function handleErrors(result, res) {
  res.end("error: " + result.error.stack || result.error);
}

rdfstore.create(function(error, st) {
  store = st;
  storeSeed(function(err) {
    if (err) console.error("seed failed", err);
    else startServer();
  });
});

function storeSeed(cb) {
  store.rdf.setPrefix("rdf", "http://www.w3.org/1999/02/22-rdf-syntax-ns#");
  store.rdf.setPrefix("disco", "http://disco-network.org/resource/");

  let graph = store.rdf.createGraph();
  let node = createNamedNode.bind(store);
  let literal = createLiteral.bind(store);

  graph.add(store.rdf.createTriple(
    node("disco:post1"), node("rdf:type"), node("disco:Post")
  ));
  graph.add(store.rdf.createTriple(
    node("disco:post1"), node("disco:id"), literal("1")
  ));
  graph.add(store.rdf.createTriple(
    node("disco:post1"), node("disco:content"), node("disco:content1")
  ));

  graph.add(store.rdf.createTriple(
    node("disco:post2"), node("rdf:type"), node("disco:Post")
  ));
  graph.add(store.rdf.createTriple(
    node("disco:post2"), node("disco:id"), literal("2")
  ));
  graph.add(store.rdf.createTriple(
    node("disco:post2"), node("disco:content"), node("disco:content2")
  ));
  graph.add(store.rdf.createTriple(
    node("disco:post2"), node("disco:parent"), node("disco:post1")
  ));

  graph.add(store.rdf.createTriple(
    node("disco:content1"), node("disco:id"), literal("1")
  ));
  graph.add(store.rdf.createTriple(
    node("disco:content1"), node("disco:title"), literal("Post Nr. 1")
  ));

  graph.add(store.rdf.createTriple(
    node("disco:content2"), node("disco:id"), literal("2")
  ));
  graph.add(store.rdf.createTriple(
    node("disco:content2"), node("disco:title"), literal("Post Nr. 2")
  ));

  store.insert(graph, storeName, cb);
}

function createNamedNode(str) {
  return this.rdf.createNamedNode(this.rdf.resolve(str));
}

function createLiteral(str) {
  return this.rdf.createLiteral(str);
}

function startServer() {
  provider = new providerModule.SparqlProvider(store, storeName);
  app.listen(config.port);
  console.log("server is listening on port " + config.port);
}
