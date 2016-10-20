/** @module */
import base = require("./sparql_provider_base");
import result = require("../result");

export class SparqlProvider implements base.ISparqlProvider {
  constructor(private store, private graphName: string) { }

  public query(queryString: string, cb: (result: result.AnyResult) => void): void {
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
}
