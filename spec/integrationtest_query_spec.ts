import odataQueryEngine = require("../src/adapter/query_engine");
import sparqlProviderModule = require("../src/sparql/sparql_provider");
import rdfstore = require("rdfstore");

describe("The query engine should evaluate", () => {
  function createQuerySpec(query: string, cb: (results: any) => void) {
    it(query, (done) => {
      rdfstore.create((error, store) => {
        let graphName = "http://example.org/";
        storeSeed(store, graphName, () => {
          let sparqlProvider = new sparqlProviderModule.SparqlProvider(store, graphName);
          let engine = new odataQueryEngine.QueryEngine();
          engine.setSparqlProvider(sparqlProvider);
          engine.query(query, results => {
            cb(results);
            done();
          });
        });
      });
    });
  }

  createQuerySpec("/Posts", answer => {
    let result = answer.result;
    expectSuccess(answer);
    expect(result.length).toBe(1);
    expect(result[0].Id).toBe("1");
  });

  createQuerySpec("/Posts?$expand=Content", answer => {
    let result = answer.result;
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

  createQuerySpec("/Posts?$expand=Content/Content", answer => {
    let result = answer.result;
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

  let graph = store.rdf.createGraph();
  graph.add(store.rdf.createTriple(
    store.rdf.createNamedNode(store.rdf.resolve("disco:post1")),
    store.rdf.createNamedNode(store.rdf.resolve("rdf:type")),
    store.rdf.createNamedNode(store.rdf.resolve("disco:Post"))
  ));
  graph.add(store.rdf.createTriple(
    store.rdf.createNamedNode(store.rdf.resolve("disco:post1")),
    store.rdf.createNamedNode(store.rdf.resolve("disco:id")),
    store.rdf.createLiteral("1")
  ));
  graph.add(store.rdf.createTriple(
    store.rdf.createNamedNode(store.rdf.resolve("disco:post1")),
    store.rdf.createNamedNode(store.rdf.resolve("disco:content")),
    store.rdf.createNamedNode(store.rdf.resolve("disco:post1"))
  ));
  graph.add(store.rdf.createTriple(
    store.rdf.createNamedNode(store.rdf.resolve("disco:post1")),
    store.rdf.createNamedNode(store.rdf.resolve("disco:parent")),
    store.rdf.createLiteral("null")
  ));

  store.insert(graph, graphName, cb);
}