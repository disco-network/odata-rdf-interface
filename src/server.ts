import connect = require("connect");
import config = require("./config");

import providerModule = require("./sparql/sparql_provider");

import rdfstore = require("rdfstore");

import { IHttpRequestHandler, IHttpResponseSender } from "./odata/http";
import { GetHandler, OptionsHandler } from "./bootstrap/adapter/queryengine";
import { Schema } from "./odata/schema";

let store = null;
let provider;
let storeName = "http://datokrat.sirius.uberspace.de/disco-test";
let schema = new Schema();

let app = connect();

app.use(config.publicRelativeServiceDirectory + "/", function(req, res, next) {
  let engine: IHttpRequestHandler;
  let responseSender: IHttpResponseSender = new ResponseSender(res);
  if (req.method === "GET") {
    engine = new GetHandler(schema, provider, responseSender);
  }
  else if (req.method === "OPTIONS") {
    engine = new OptionsHandler(responseSender);
  }
  else res.send(403);
  engine.query(convertHttpRequest(req));
});

class ResponseSender implements IHttpResponseSender {
  private body: string;
  private code: number;
  private headers: { [id: string]: string } = {};

  constructor(private res) {}

  public sendStatusCode(code: number) {
    this.code = code;
  }

  public sendBody(body: string) {
    this.body = body;
  }

  public sendHeader(key: string, value: string) {
    this.headers[key] = value;
  }

  public finishResponse() {
    this.res.writeHeader(this.code, this.headers);
    this.res.end(this.body);
  }
}

function convertHttpRequest(req) {
  return {
    relativeUrl: req.url,
    body: "@todo",
  };
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
