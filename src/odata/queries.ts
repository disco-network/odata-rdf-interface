/** @module */
import Schema = require("./schema");

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
  public evaluate(results: any[], context: QueryContext): any[] {
    let entities = {};

    results.forEach(result => {
      let id = context.getUniqueIdOfResult(result);
      if (entities[id] === undefined) {
        entities[id] = {};
      }
      context.forEachElementaryPropertyOfResult(result, (value, property) => {
        this.assignElementaryProperty(entities[id], property, value);
      });
      context.forEachComplexPropertyOfResult(result, (subResult, property, hasValue) => {
        if (hasValue)
          this.assignComplexProperty(entities[id], property, subResult, context);
      });
    });

    return Object.keys(entities).map(key => entities[key]);
  }

  private assignElementaryProperty(entity, property: Schema.Property, value) {
    let oldValue = entity[property.getName()];
    if (property.isQuantityOne()) {
      if (oldValue !== undefined && value !== undefined && oldValue !== value)
        throw new Error("found different values for a property of quantity one: " + property.getName());
      else
        entity[property.getName()] = value;
    }
  }

  private assignComplexProperty(entity, property: Schema.Property, result, context: QueryContext) {
    let oldValue = entity[property.getName()];
    if (property.isQuantityOne()) {
      let subEntity;
      if (oldValue !== undefined)
        subEntity = oldValue;
      else
        subEntity = entity[property.getName()] = {};
      let subContext = context.getSubContext(property.getName());
      subContext.forEachElementaryPropertyOfResult(result, (subValue, subProperty) => {
        this.assignElementaryProperty(subEntity, subProperty, subValue);
      });
      subContext.forEachComplexPropertyOfResult(result, (subResult, subProperty, hasValue) => {
        if (hasValue)
          this.assignComplexProperty(subEntity, subProperty, subResult, subContext);
      });
    }
  }
}

export interface QueryContext {
  /** Iterate over all elementary properties expected by the query and pass their value. */
  forEachElementaryPropertyOfResult(result, fn: (value, property: Schema.Property) => void): void;
  /** Iterate over all complex properties expected by the query. */
  forEachComplexPropertyOfResult(result, fn: (subResult, property: Schema.Property, hasValue: boolean) => void): void;
  getUniqueIdOfResult(result): string;
  getSubContext(property: string): QueryContext;
}

export enum ErrorTypes {
  NONE,
  DB,
  ENTITYSET_NOTFOUND,
  PROPERTY_NOTFOUND,
}
