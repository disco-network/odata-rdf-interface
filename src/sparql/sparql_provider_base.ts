/** @module */

export interface SparqlProviderBase {
  querySelect(queryString: string, cb: (result: {error?, result?}) => void): void;
}
