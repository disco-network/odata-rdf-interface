import { assert } from "chai";

import { GetHandler } from "../src/odata/queryengine";
import { ODataRepository } from "../src/bootstrap/adapter/odatarepository";
import { GetRequestParser } from "../src/bootstrap/odata/parser";
import { Schema } from "../src/odata/schema";
import { Result } from "../src/result";
import sparqlProviderModule = require("../src/sparql/sparql_provider");
import rdfstore = require("rdfstore");

describe("The GetHandler should evaluate", () => {

  /* @todo get test queries from array */
  createQuerySpec("/Posts", answer => {
    let result = answer.result();
    expectSuccess(answer);
    assert.strictEqual(result.length, 2);
    assert.strictEqual(result[0].Id, "1");
    assert.strictEqual(result[1].Id, "2");
  }, () => {
    "before spec";
  });

  createQuerySpec("/Posts?$expand=Content", answer => {
    let result = answer.result();
    expectSuccess(answer);
    assert.deepEqual(result, [
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
  }, () => {
    "before spec";
  });

  createQuerySpec("/Posts?$expand=Parent", answer => {
    let result = answer.result();
    expectSuccess(answer);
    assert.deepEqual(result, [
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

  createQuerySpec("/Posts?$expand=Children", answer => {
    let result = answer.result();
    expectSuccess(answer);
    assert.deepEqual(result, [
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
  }, () => {
    "before spec";
  });

  createQuerySpec("/Posts?$expand=Children/Parent", answer => {
    let result = answer.result();
    expectSuccess(answer);
    assert.deepEqual(result, [
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
  }, () => {
    "before spec";
  });

  createQuerySpec("/Posts?$filter='0' eq '1'", answer => {
    expectSuccess(answer);
    assert.strictEqual(answer.result().length, 0);
  });

  createQuerySpec("/Posts?$filter=Id eq '1'", answer => {
    expectSuccess(answer);
    assert.strictEqual(answer.result().length, 1);
  });

  createQuerySpec("/Posts?$filter=Id eq '0'", answer => {
    expectSuccess(answer);
    assert.strictEqual(answer.result().length, 0);
  });

  createQuerySpec("/Posts?$filter=(Id eq '1')", answer => {
    expectSuccess(answer);
    assert.strictEqual(answer.result().length, 1);
  });

  createQuerySpec("/Posts?$filter=Id eq 1", answer => {
    expectSuccess(answer);
    assert.strictEqual(answer.result().length, 1);
  });

  createQuerySpec("/Posts?$filter=(Id eq 1) or (Id eq 2)", answer => {
    expectSuccess(answer);
    assert.strictEqual(answer.result().length, 2);
  });

  createQuerySpec("/Posts?$filter=(Id eq 1) and ((Id eq 2) or (Id eq 1))", answer => {
    expectSuccess(answer);
    assert.strictEqual(answer.result().length, 1);
  });

  createQuerySpec("/Posts?$filter=(Id eq 1) or (Id eq 2) and (Id eq 2)", answer => {
    expectSuccess(answer);
    assert.strictEqual(answer.result().length, 2);
  });

  createQuerySpec("/Posts?$filter=Content/Id eq 1", answer => {
    expectSuccess(answer);
    assert.strictEqual(answer.result().length, 1);
    assert.strictEqual(answer.result()[0].ContentId, "1");
  }, () => {
    "before spec";
  });

  createQuerySpec("/Posts?$filter=Children/any(it: 1 eq 1)", answer => {
    expectSuccess(answer);
    assert.strictEqual(answer.result().length, 1);
  }, () => {
    "before spec";
  });

  createQuerySpec("/Posts?$filter=Children/any(it: it/Id eq 2)", answer => {
    expectSuccess(answer);
    assert.strictEqual(answer.result().length, 1);
  });

  createQuerySpec("/Posts?$filter=Children/any(it: Id eq 1)", answer => {
    expectSuccess(answer);
    assert.strictEqual(answer.result().length, 1);
  });

  createQuerySpec("/Posts?$filter=Children/any(it: Id eq 2)", answer => {
    expectSuccess(answer);
    assert.strictEqual(answer.result().length, 0);
  });

  createQuerySpec("/Posts?$filter=Children/any(it: it/Children/any(it2: 1 eq 1))", answer => {
    expectSuccess(answer);
  }, () => {
    "before execution";
  });

  function createQuerySpec(query: string, cb: (results) => void, before: () => void = () => null,
                           pending: boolean = false) {
    let fn = pending ? xit : it;
    fn(query, (done) => {
      before();
      rdfstore.create((error, store) => {
        let graphName = "http://example.org/";
        storeSeed(store, graphName, () => {
          let sparqlProvider = new sparqlProviderModule.SparqlProvider(store, graphName);
          let repository = new ODataRepository(sparqlProvider);
          let responseSender = {
            success: function(entities) {
              cb(Result.success(entities)); done();
            },
          };
          let getHandler = new GetHandler(new Schema(), new GetRequestParser(), repository, responseSender);
          try { getHandler.query({ relativeUrl: query, body: "" }); }
          catch (e) {
            assert.strictEqual(e.stack || e, "no exception");
            done();
          }
        });
      });
    });
  }
});

function expectSuccess(answer) {
  assert.isUndefined(answer.error());
  assert.isDefined(answer.result());
}

function storeSeed(store, graphName, cb) {
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

  store.insert(graph, graphName, cb);
}

function createNamedNode(str) {
  return this.rdf.createNamedNode(this.rdf.resolve(str));
}

function createLiteral(str) {
  return this.rdf.createLiteral(str);
}
