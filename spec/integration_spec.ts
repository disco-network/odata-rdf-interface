import { assert, assertEx, match } from "../src/assert";

import * as rdfstore from "rdfstore";
import { SparqlProvider } from "../src/sparql/sparql_provider";
import { GetHandler, PostHandler } from "../src/bootstrap/adapter/queryengine";
import { IHttpResponseSender } from "../src/odata/http";
import { Schema } from "../src/odata/schema";

const graph = "http://test.disco-network.org/";
const schema = new Schema();

describe("integration tests", () => {
  it("POST and GET an entity", done => {
    initOdataServer((get, post) => {
      post.query({ relativeUrl: "/Content", body: "{ \"Title\": \"Lorem\" }" }, new HttpResponseSender(() => {
        get.query({ relativeUrl: "/Content", body: "" }, new HttpResponseSender(() => null, body => {
          assertEx.deepEqual(JSON.parse(body), {
            "odata.metadata": match.any,
            "value": [{
              "Id": match.any,
              "Title": "Lorem",
            }],
          });
          done();
        }));
      }));
    });
  });

  it("POST and GET an entity with foreign key property", done => {
    initOdataServer((get, post) => {
      post.query({ relativeUrl: "/Content", body: "{ \"Title\": \"Lorem\" }" }, new HttpResponseSender(() => {
        get.query({ relativeUrl: "/Content", body: "" }, new HttpResponseSender(() => null, body => {
          const cntId = JSON.parse(body).value[0].Id;
          insertPost(post, get, cntId);
        }));
      }));
    });

    function insertPost(post: PostHandler, get: GetHandler, cntId: string) {
      post.query({ relativeUrl: "/Posts", body: `{ "ContentId": "${cntId}" }` }, new HttpResponseSender(() => {
        get.query({ relativeUrl: "/Posts", body: "" }, new HttpResponseSender(() => null, body => {
          assertEx.deepEqual(JSON.parse(body), {
            "odata.metadata": match.any,
            "value": [{
              "Id": match.any,
              "ContentId": cntId,
              "ParentId": null,
            }],
          });
          done();
        }));
      }));
    }
  });
});

function initOdataServer(cb: (get: GetHandler, post: PostHandler) => void) {
  initSparqlProvider(provider => {
    cb(new GetHandler(schema, provider, graph), new PostHandler(schema, provider, graph));
  });
}

function initSparqlProvider(cb: (provider: SparqlProvider) => void) {
  rdfstore.create((err, store) => {
    cb(new SparqlProvider(store, graph));
  });
}

class HttpResponseSender implements IHttpResponseSender {

  constructor(then: () => void, onBody?: (body: string) => void) {
    this.finishResponse = then;
    if (onBody) this.sendBody = onBody;
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

  }
}
