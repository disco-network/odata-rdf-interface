/** @module */
import _ = require('../util');
import base = require('./sparql_provider_base')

export class SparqlProvider implements base.SparqlProviderBase {
	constructor(private store, private graphName: string) { }

  public querySelect(queryString: string, cb: (result: {error?, result?}) => void): void {
    //TODO: ensure that query has kind SELECT
    this.store.executeWithEnvironment(queryString, [this.graphName], [], function(err, results) {
      if(!err) {
        cb({ result: results });
      }
      else {
        cb({ error: err });
      }
    });
  }
}