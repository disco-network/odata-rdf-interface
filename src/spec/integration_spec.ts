import { assert, assertEx, match } from "../lib/assert";

import * as rdfstore from "rdfstore";
import { SparqlProvider } from "../lib/sparql/sparql_provider";
import { GetHandler, PostHandler } from "../lib/bootstrap/adapter/queryengine";
import { IHttpResponseSender } from "../lib/odata/http";
import { Schema } from "../lib/odata/schema";
import { schemaWithMandatoryProperty, schemaWithInverseProperty } from "./helpers/schemata";

const graph = "http://test.disco-network.org/";
const schema = new Schema();

describe("integration tests", () => {
  it("POST and GET an entity", done => {
    initOdataServer((get, post) => {
      post.query({ relativeUrl: "/Content", body: "{ \"Title\": \"Lorem\" }" }, new HttpResponseSender(() => {
        get.query({ relativeUrl: "/Content", body: "" }, new HttpResponseSender(() => null,
        {
          sendBody: body => {
            try {
              assertEx.deepEqual(JSON.parse(body), {
                "odata.metadata": match.any,
                "value": [{
                  "odata.id": match.any,
                  "Id": match.any,
                  "Title": "Lorem",
                }],
              });
              done();
            }
            catch (e) {
              assert.equal(body, "json");
            }
          },
        }));
      }));
    });
  });

  it("POST and GET an entity with foreign key property", done => {
    initOdataServer((get, post) => {
      post.query({ relativeUrl: "/Content", body: "{ \"Title\": \"Lorem\" }" }, new HttpResponseSender(() => {
        get.query({ relativeUrl: "/Content", body: "" }, new HttpResponseSender(() => null,
        {
          sendBody: body => {
            const cntId = JSON.parse(body).value[0].Id;
            insertPost(post, get, cntId);
          },
        }));
      }));
    });

    function insertPost(post: PostHandler, get: GetHandler, cntId: string) {
      post.query({ relativeUrl: "/Posts", body: `{ "ContentId": "${cntId}" }` }, new HttpResponseSender(() => {
        get.query({ relativeUrl: "/Posts", body: "" }, new HttpResponseSender(() => null,
        {
          sendBody: body => {
            try {
              assertEx.deepEqual(JSON.parse(body), {
                "odata.metadata": match.any,
                "value": [{
                  "odata.id": match.any,
                  "Id": match.any,
                  "ContentId": cntId,
                  "Content@odata.navigationLinkUrl": match.any,
                  "ParentId": null,
                }],
              });
              done();
              return;
            }
            catch (e) {
              done(e);
              return;
            }
          },
        }));
      }));
    }
  });

  it("POST an entity, retrieve it directly from the response body", done => {
    initOdataServer((get, post) => {
      post.query({ relativeUrl: "/Content", body: "{ \"Title\": \"Lorem\" }" }, new HttpResponseSender(() => null,
      {
        sendBody: body => {
          assertEx.deepEqual(JSON.parse(body), {
            "odata.metadata": match.any,
            "odata.id": match.any,
            "Id": match.any,
            "Title": "Lorem",
          });
          done();
        },
      }));
    });
  });

  /* @todo add unit test for EntityInitializer */
  it("POST an entity with Title: null", done => {
    initOdataServer((get, post) => {
      post.query({ relativeUrl: "/Content", body: "{ \"Title\": null }" }, new HttpResponseSender(() => null,
      {
        sendBody: body => {
          assertEx.deepEqual(JSON.parse(body), {
            "odata.metadata": match.any,
            "odata.id": match.any,
            "Id": match.any,
            "Title": null,
          });
          done();
        },
      }));
    });
  });

  it("POST an entity with a mandatory property = null => FAIL", done => {
    initOdataServer((get, post) => {
      post.query({ relativeUrl: "/Entities", body: `{ "Value": null }` }, new HttpResponseSender(() => null,
      {
        sendStatusCode: code => {
          assert.strictEqual(code, 400);
          done();
        },
      }));
    }, schemaWithMandatoryProperty);
  });

  it("POST an entity with an unknown property => FAIL", done => {
    initOdataServer((get, post) => {
      post.query({ relativeUrl: "/Entities", body: `{}` }, new HttpResponseSender(() => null,
      {
        sendStatusCode: code => {
          assert.strictEqual(code, 400);
          done();
        },
      }));
    }, schemaWithMandatoryProperty);
  });

  it("POST an entity with an inverse property", done => {
    initOdataServer((get, post) => {
      post.query({ relativeUrl: "/Integers", body: `{ "Id": 1 }` }, new HttpResponseSender(() => null,
      {
        sendBody: body => {
          post.query({ relativeUrl: "/Integers", body: `{ "Id": 2, "Prev": 1 }` },
          new HttpResponseSender(() => null, {
            sendBody: body2 => {
              const secondInteger = JSON.parse(body2);
              try {
                assert.strictEqual(null, secondInteger.Next);
                assert.strictEqual("1", secondInteger.Prev);
              } catch (e) {
                done(e);
                return;
              }
              done();
            },
          }));
        },
      }));
    }, schemaWithInverseProperty);
  });

  xit("POST and entity with implicit Title: null");
});

function initOdataServer(cb: (get: GetHandler, post: PostHandler) => void, schm = schema) {
  initSparqlProvider(provider => {
    const serviceUri = "http://ex.org/odata/";
    cb(new GetHandler(serviceUri, schm, provider, graph), new PostHandler(serviceUri, schm, provider, graph));
  });
}

function initSparqlProvider(cb: (provider: SparqlProvider) => void) {
  rdfstore.create((err, store) => {
    cb(new SparqlProvider(store, graph));
  });
}

class HttpResponseSender implements IHttpResponseSender {

  constructor(then: () => void, props?: any) {
    this.finishResponse = then;
    if (props !== undefined) {
      for (const prop of Object.keys(props)) {
        this[prop] = props[prop];
      }
    }
  }

  public sendStatusCode(): any {
    //
  }

  public sendHeader(): any {
    //
  }

  public sendBody(body: string): any {
    //
  }

  public finishResponse(): any {
    //
  }
}
