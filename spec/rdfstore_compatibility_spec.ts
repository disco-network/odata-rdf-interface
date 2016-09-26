import { assert } from "chai";
import rdfstore = require("rdfstore");

describe("rdfstore should execute", function() {
  createSpec("SELECT * WHERE { ?s rdf:type disco:Post }", answer => {
    assert.strictEqual(answer.error, null);
    assert.isAbove(answer.result.length, 0);
  });

  createSpec("SELECT * WHERE { ?s rdf:type disco:Post FILTER EXISTS { ?s disco:id '1'  } }", answer => {
    assert.strictEqual(answer.error, null);
    assert.strictEqual(answer.result.length, 1);
  });

  createSpec("SELECT * WHERE { ?s rdf:type disco:Post . ?s disco:id ?id FILTER(?id = '1') }", answer => {
    assert.strictEqual(answer.error, null);
    assert.strictEqual(answer.result.length, 1);
  });

  createSpec("SELECT * WHERE { ?s rdf:type disco:Post FILTER(EXISTS { ?s disco:id '1' }) }", answer => {
    assert.strictEqual(answer.error, null);
    assert.strictEqual(answer.result.length, 1);
  });

  createSpec("SELECT * WHERE { ?s rdf:type disco:Post . ?s disco:id ?id "
    + "FILTER(?id = '1' && EXISTS { ?s disco:content ?cnt . ?cnt disco:id '1' }) }", answer => {
    assert.strictEqual(answer.error, null);
    assert.strictEqual(answer.result.length, 1);
  });

  createSpec("SELECT * WHERE { ?s rdf:type disco:Post . ?s disco:id ?id "
    + "FILTER(?id = '2' || EXISTS { ?s disco:content ?cnt . ?cnt disco:id '1' }) }", answer => {
    assert.strictEqual(answer.error, null);
    assert.strictEqual(answer.result.length, 2);
  });

  createSpec("SELECT * WHERE { ?s rdf:type disco:Post . ?s disco:id ?id . FILTER (?id = 1) }", answer => {
    assert.strictEqual(answer.error, null);
    assert.strictEqual(answer.result.length, 0);
  });

  createSpec("SELECT * WHERE { ?s rdf:type disco:Post . ?s disco:id ?id . FILTER (?id = '1') }", answer => {
    assert.strictEqual(answer.error, null);
    assert.strictEqual(answer.result.length, 1);
  });

  createSpec("SELECT * WHERE { { ?x0 disco:id ?x1 } . FILTER(EXISTS {  { ?x6 disco:parent ?x0 } }) }", answer => {
    assert.strictEqual(answer.error, null);
    assert.strictEqual(answer.result.length, 1);
  });

  createSpec("SELECT * WHERE {}", answer => {
    assert.strictEqual(answer.error, null);
    assert.strictEqual(answer.result.length, 0);
  });

  createSpec("SELECT * WHERE { OPTIONAL { ?post disco:id '1' . ?post rdf:type disco:Post } }", answer => {
    assert.strictEqual(answer.error, null);
    assert.strictEqual(answer.result.length, 1);
  });

  createSpec(`PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
PREFIX disco: <http://disco-network.org/resource/>
SELECT * WHERE {
  {
    ?x0 disco:id ?x1
    {
      ?x0 disco:content ?x2 . 
      ?x0 disco:content ?x2
      { 
        ?x2 disco:id ?x3 } .
      ?x2 disco:id ?x6
      { 
        ?x2 disco:title ?x7 } . 
      OPTIONAL {
        ?x0 disco:parent ?x4 . 
        {
          ?x4 disco:id ?x5
        }
      }
    }
  }
}`, answer => assert.strictEqual(answer.error, null));

  createSpec("SELECT * WHERE { OPTIONAL { ?s ?p ?o } FILTER(BOUND(?s)) }", answer => {
    assert.strictEqual(answer.error, null);
    assert.strictEqual(answer.result.length > 0, true);
  });

  createSpec("SELECT * WHERE { OPTIONAL { ?s <http://unknown.prop/> ?o } FILTER(BOUND(?s)) }", answer => {
    assert.strictEqual(answer.error, null);
    assert.strictEqual(answer.result.length, 0);
  });

  createSpec("PREFIX disco: <http://disco-network.org/resource/> INSERT { <test> disco:id '1' } WHERE {}", answer => {
    assert.strictEqual(answer.error, null);
  });

  createSpec("SELECT * WHERE { ?s ?p ?o . FILTER( ?s = ?none ) }", answer => {
    assert.strictEqual(answer.error, null);
    assert.strictEqual(answer.result.length, 0);
  });

  createSpec("SELECT * WHERE { ?s ?p ?o . FILTER( ?nope = ?none ) }", answer => {
    assert.strictEqual(answer.error, null);
    assert.strictEqual(answer.result.length, 0);
  });

  createSpec("SELECT * WHERE { ?s ?p ?o . FILTER( ?nope = ?none || !(BOUND(?nope) || BOUND(?none)) ) }", answer => {
    assert.strictEqual(answer.error, null);
    assert.strictEqual(answer.result.length > 0, true);
  });

  createSpec("SELECT * WHERE { ?s ?p ?o . FILTER( ?unbound > 1 || ?o = ?o ) }", answer => {
    assert.strictEqual(answer.error, null);
    assert.strictEqual(answer.result.length > 0, true);
  });

  createSpec("SELECT * WHERE { ?s ?p ?o . FILTER( ?unbound > 1 && ?o = ?o ) }", answer => {
    assert.strictEqual(answer.error, null);
    assert.strictEqual(answer.result.length, 0);
  });

  createSpec(`PREFIX disco: <http://disco-network.org/resource/>
SELECT * WHERE { { ?x0 disco:id ?x1 . { OPTIONAL { ?x0 disco:parent ?x4 . ?x4 disco:id ?x5 } } } }`, answer => {
    assert.strictEqual(answer.error, null);
    assert.strictEqual(answer.result.length, 4);
});

  it("should store inserted triples", done => {
    const prefixes = "PREFIX disco: <http://disco-network.org/resource/> ";
    const graphName = "http://example.org";
    const firstQuery = "INSERT DATA { GRAPH <" + graphName + "> { <test> disco:id '1' } }";
    const secondQuery = "SELECT * WHERE { ?test disco:id ?id }";
    rdfstore.create((error, store) => {
      store.executeWithEnvironment(prefixes + firstQuery, [graphName], [], (err, results) => {
        assert.strictEqual(err, null);
        store.executeWithEnvironment(prefixes + secondQuery, [graphName], [], (err2, results2) => {
          assert.strictEqual(err2, null);
          assert.strictEqual(results2.length, 1);
          done();
        });
      });
    });
  });

  function createSpec(query: string, cb: (results: any) => void) {
    let prefixes = "PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> ";
    prefixes += "PREFIX disco: <http://disco-network.org/resource/> ";
    it(query, done => {
      rdfstore.create((error, store) => {
        let graphName = "http://example.org";
        storeSeed(store, graphName, () => {
          store.executeWithEnvironment(prefixes + query, [graphName], [], (err, results) => {
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
