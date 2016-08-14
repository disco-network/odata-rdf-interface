import connect = require("connect");
import config = require("./config");

import providerModule = require("./sparql/sparql_provider");

import rdfstore = require("rdfstore");

import { IHttpRequestHandler, IHttpResponseSender } from "./odata/http";
import { GetHandler, OptionsHandler } from "./bootstrap/adapter/queryengine";
import { Schema } from "./odata/schema";
import { Result } from "./result";

let store = null;
let provider;
let storeName = "http://datokrat.sirius.uberspace.de/disco-test";
let schema = new Schema();

let app = connect();

app.use(config.publicRelativeServiceDirectory + "/", function(req, res, next) {
  let engine: IHttpRequestHandler;
  let responseSender: IHttpResponseSender;
  if (req.method === "GET") {
    engine = new GetHandler(schema, provider);
    responseSender = new ResponseSender(res);
  }
  else if (req.method === "OPTIONS") {
    engine = new OptionsHandler();
    responseSender = new OptionsResponseSender(res);
  }
  else res.send(403);
  engine.query(convertHttpRequest(req), responseSender);
});

class ResponseSender implements IHttpResponseSender {
  private body: string;

  constructor(private res) {}

  public sendBody(body: string) {
    this.body = body;
  }

  public sendHeader(key: string, value: string) {
    throw new Error("Headers are not yet implemented.");
  }

  public finishResponse() {
    sendResults(this.res, Result.success(this.body));
  }
}

class OptionsResponseSender implements IHttpResponseSender {
  private body: string;
  private headers: { [id: string]: string } = {};

  constructor(private res) {}

  public sendBody(body: string) {
    this.body = body;
  }

  public sendHeader(key: string, value: string) {
    this.headers[key] = value;
  }

  public finishResponse() {
    this.res.writeHeader(200, this.headers);
    this.res.end(this.body);
  }
}

function convertHttpRequest(req) {
  return {
    relativeUrl: req.url,
    body: "@todo",
  };
}

/**
 * Pass the results of the query to the HTTP response object
 */
function sendResults(res, result): void {
  if (!result.error()) {
    let content = JSON.stringify({
      "odata.metadata": config.publicRootDirectory + config.publicRelativeServiceDirectory + "/",
      "value": JSON.parse(result.result()),
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
