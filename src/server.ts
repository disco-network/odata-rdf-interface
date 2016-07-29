import connect = require("connect");
import config = require("./config");

import providerModule = require("./sparql/sparql_provider");

import rdfstore = require("rdfstore");

import queryEngine = require("./adapter/query_engine");

let store = null;
let provider;
let storeName = "http://datokrat.sirius.uberspace.de/disco-test";

let app = connect();

app.use(config.publicRelativeServiceDirectory + "/", function(req, res, next) {
  if (req.method === "GET") {
    let engine = new queryEngine.QueryEngine();
    engine.setSparqlProvider(provider);
    engine.query(req.url, result => {
      sendResults(res, result);
    });
  }
  else if (req.method === "OPTIONS") {
    res.writeHeader(200, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers":
        "MaxDataServiceVersion, DataServiceVersion, Authorization, Accept, Authorization, odata-maxversion",
    });
    res.end();
  }
});

/**
 * Pass the results of the query to the HTTP response object
 */
function sendResults(res, result): void {
  if (!result.error()) {
    let content = JSON.stringify({
      "odata.metadata": config.publicRootDirectory + config.publicRelativeServiceDirectory + "/",
      "value": result.result(),
    }, null, 2);

    res.writeHeader(200, {
      "Content-Type": "application/json;charset=utf-8",
      "Content-Length": content.length.toString(),
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Expose-Headers": "MaxDataServiceVersion, DataServiceVersion",
    });
    res.end(content);
  }
  else {
    handleErrors(this.result, res);
  }
}
function handleErrors(result, res) {
  res.end("error: " + result.error().stack || result.error());
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
