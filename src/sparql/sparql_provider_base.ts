import result = require("../result");

export interface SparqlProviderBase {
  querySelect(queryString: string, cb: (result: result.AnyResult) => void): void;
}
