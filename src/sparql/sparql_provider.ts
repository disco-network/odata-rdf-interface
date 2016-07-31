/** @module */
import base = require("./sparql_provider_base");
import result = require("../result");

export class SparqlProvider implements base.SparqlProviderBase {
  constructor(private store, private graphName: string) { }

  public querySelect(queryString: string, cb: (result: result.AnyResult) => void): void {
    // TODO: ensure that query has kind SELECT
    this.store.executeWithEnvironment(queryString, [this.graphName], [], function(err, results) {
      if (!err) {
        cb(result.Result.success(results));
      }
      else {
        cb(result.Result.error(err));
      }
    });
  }

  public query(queryString: string, cb: (result: result.AnyResult) => void): void {
    //
  }
}
