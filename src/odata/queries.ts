/** @module */
import Schema = require("./schema");

export interface Query {
  run(sparqlProvider, cb: (result) => void): void;
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
  public evaluate(results: any[], context: QueryContext): any[] {
    let entityCollection = new EvaluatedEntityCollection(context, Schema.EntityKind.Complex);

    results.forEach(result => {
      entityCollection.applyResult(result);
    });

    return entityCollection.serializeToODataJson();
  }
}

export interface EvaluatedEntity {
  /** Apply the values of variables in this result object. */
  applyResult(result: any): void;
  /** Create a JS data object conforming to the OData output format. */
  serializeToODataJson(): any;
}

export class EvaluatedEntityCollection implements EvaluatedEntity {
  private context: QueryContext;
  private kind: Schema.EntityKind;
  private entities: { [id: string]: EvaluatedEntity } = {};

  constructor(context: QueryContext, kind: Schema.EntityKind) {
    this.context = context;
    this.kind = kind;
  }

  public applyResult(result: any): void {
    let id = this.context.getUniqueIdOfResult(result);
    if (id === undefined) return;
    if (this.entities[id] === undefined) {
      this.entities[id] = EvaluatedEntityFactory.fromEntityKind(this.kind, this.context);
    }
    this.entities[id].applyResult(result);
  }

  public serializeToODataJson() {
    return Object.keys(this.entities).map(id => this.entities[id].serializeToODataJson());
  }
}

export class EvaluatedComplexEntity implements EvaluatedEntity {
  private context: QueryContext;
  private value: { [id: string]: EvaluatedEntity } = undefined;
  private id: any;

  constructor(context: QueryContext) {
    this.context = context;
  }

  public applyResult(result: any): void {
    let id = this.context.getUniqueIdOfResult(result);
    if (id === undefined) return;
    if (this.id === undefined || id === this.id) {
      if (this.value === undefined) {
        this.id = id;
        this.value = {};
      }
      this.context.forEachElementaryPropertyOfResult(result, (value, property, hasValue) => {
        this.applyResultToProperty(property, value);
      });
      this.context.forEachComplexPropertyOfResult(result, (value, property, hasValue) => {
        this.applyResultToProperty(property, value);
      });
    }
    else {
      throw new Error("found different values for a property of quantity one");
    }
  }

  public serializeToODataJson(): any {
    if (this.id === undefined) return null;
    let serialized = {};

    let serializeProperty = property => {
      let propertyName = property.getName();
      let entity = this.value[propertyName];
      serialized[propertyName] = entity !== undefined ? entity.serializeToODataJson() : null;
    };

    this.context.forEachElementaryPropertySchema(serializeProperty);
    this.context.forEachComplexPropertySchema(serializeProperty);

    return serialized;
  }

  private applyResultToProperty(property: Schema.Property, result: any) {
    if (this.value[property.getName()] === undefined)
      this.value[property.getName()] = EvaluatedEntityFactory.fromPropertyWithContext(property, this.context);

    if (result !== undefined) this.value[property.getName()].applyResult(result);
  }
}

export class EvaluatedElementaryEntity implements EvaluatedEntity {
  private value: any = undefined;

  public applyResult(value: any): void {
    if (this.value === undefined) {
      this.value = value;
    }
    else if (this.value !== value) {
      throw new Error("found different values for a property of quantity one");
    }
  }

  public serializeToODataJson(): any {
    return this.value === undefined ? null : this.value;
  }
}

export class EvaluatedEntityFactory {
  public static fromPropertyWithContext(property: Schema.Property, context: QueryContext): EvaluatedEntity {
    let kind = property.getEntityKind();
    let subContext = context.getSubContext(property.getName());
    if (property.isQuantityOne()) {
      return EvaluatedEntityFactory.fromEntityKind(kind, subContext);
    }
    else {
      return new EvaluatedEntityCollection(subContext, kind);
    }
  }

  public static fromEntityKind(kind: Schema.EntityKind, context: QueryContext): EvaluatedEntity {
    switch (kind) {
      case Schema.EntityKind.Elementary:
        return new EvaluatedElementaryEntity();
      case Schema.EntityKind.Complex:
        return new EvaluatedComplexEntity(context);
      default:
        throw new Error("invalid EntityKind " + kind);
    }
  }
}

export interface QueryContext {
  /** Iterate over all elementary properties expected by the query and pass their value. */
  forEachElementaryPropertyOfResult(result, fn: (value, property: Schema.Property, hasValue: boolean) => void): void;
  /** Iterate over all complex properties expected by the query. */
  forEachComplexPropertyOfResult(result, fn: (subResult, property: Schema.Property, hasValue: boolean) => void): void;
  forEachElementaryPropertySchema(fn: (property: Schema.Property) => void): void;
  forEachComplexPropertySchema(fn: (property: Schema.Property) => void): void;
  getUniqueIdOfResult(result): string;
  getSubContext(property: string): QueryContext;
}

export enum ErrorTypes {
  NONE,
  DB,
  ENTITYSET_NOTFOUND,
  PROPERTY_NOTFOUND,
}
