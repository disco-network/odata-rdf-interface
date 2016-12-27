/** @module */
import base = require("./sparql_provider_base");
import result = require("../result");
import { ILogger } from "../logger";
import * as request from "request";

declare var process;

export class SparqlProvider implements base.ISparqlProvider {
  constructor(private store, private graphName: string, private logger?: ILogger) { }

  public query(queryString: string, cb: (result: result.AnyResult) => void): void {
    const timeBeforeExecution = process.hrtime();
    this.logDebug(`SPARQL query [${queryString}]`);
    this.store.executeWithEnvironment(queryString, [this.graphName], [], (err, results) => {
      const finishedAfterTime = process.hrtime(timeBeforeExecution);
      this.logDebug(`SPARQL query took [${finishedAfterTime[0] + finishedAfterTime[1] / 1000000}ms]`);
      if (!err) {
        cb(result.Result.success(results));
      }
      else {
        cb(result.Result.error(err));
      }
    });
  }

  public update(queryString: string, cb: (result: result.AnyResult) => void): void {
    this.query(queryString, cb);
  }

  private logDebug(message: string) {
    if (this.logger !== undefined)
      this.logger.debug(message);
  }
}

export class ServiceBasedSparqlProvider implements base.ISparqlProvider {

  constructor(private serviceUri: string) {
  }

  public query(queryString: string, cb: (result: result.AnyResult) => void): void {
    request(this.serviceUri + "/query", {
      method: "POST",
      headers: {
        "accept": "application/sparql-results+json",
      },
      form: {
        query: queryString,
      },
      timeout: 10000,
    }, (err, res, body) => {
      if (!err)
        cb(result.Result.success(JSON.parse(body).results.bindings));
      else
        cb(result.Result.error(err));
    });
  }

  public update(queryString: string, cb: (result: result.AnyResult) => void): void {
    request(this.serviceUri + "/update", {
      method: "POST",
      headers: {
        "accept": "application/sparql-results+json",
      },
      form: {
        update: queryString,
      },
      timeout: 10000,
    }, (err, res, body) => {
      if (!err)
        cb(result.Result.success(null));
      else
        cb(result.Result.error(err));
    });
  }
}
