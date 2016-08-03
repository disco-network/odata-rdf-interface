import result = require("../result");

/* @todo how about naming it Repository, same as the design pattern? */
export interface ISparqlProvider {
  querySelect(queryString: string, cb: (result: result.AnyResult) => void): void;
  query(queryString: string, cb: (result: result.AnyResult) => void): void;
}
