import result = require("../result");

/* @todo how about naming it Repository, same as the design pattern? */
export interface ISparqlProvider {
  query(queryString: string, cb: (result: result.AnyResult) => void): void;
}
