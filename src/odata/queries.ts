/** @module */
import _ = require('../util')

export interface Query {
  run(sparqlProvider, cb: () => void): void;
  sendResults(res): void;
}

export interface QueryModel {
  entitySetName: string;
  path: any[]; /** navigation path */
  filterOption: any;
  expandTree: any;
}

/** This class can be used to generate odata output from different sources.
 * The concrete database logic is handled by the result and context parameters.
 */
export class QueryResultEvaluator {
  // result type corresponds to what's needed by the context instance
  public evaluate(result, context: QueryContext): Object {
    var self = this;
    var ret = {};
    context.forEachElementaryPropertyOfResult(result, function(value, property) {
      ret[property.getName()] = value;
    });
    context.forEachComplexPropertyOfResult(result, function(subResult, property) {
      ret[property.getName()] = self.evaluate(subResult, context.getSubContext(property.getName()));
    });
    return ret;
  }
}

export interface QueryContext {
  forEachElementaryPropertyOfResult(result, fn: (value, property) => void): void;
  forEachComplexPropertyOfResult(result, fn: (subResult, property) => void): void;
  getSubContext(property: string): QueryContext;
}

export enum ErrorTypes {
	NONE,
	DB,
	ENTITYSET_NOTFOUND,
	PROPERTY_NOTFOUND,
}