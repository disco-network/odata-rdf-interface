/** @module */
import Schema = require("./schema");

export interface Query {
  run(sparqlProvider, cb: (result) => void): void;
}

export interface QueryModel {
  entitySetType: Schema.EntityType;
  path: any[]; /** navigation path */
  filterOption: any;
  expandTree: any;
}

/** This class can be used to generate odata output from different sources.
 * The concrete database logic is handled by the result and context parameters.
 */
export class JsonResultBuilder {
  public run(results: any[], context: QueryContext): any[] {
    let entityCollection = new EntityCollection(context, Schema.EntityKind.Complex);

    /* @smell */
    results.forEach(result => {
      entityCollection.applyResult(result);
    });

    return entityCollection.serializeToODataJson();
  }
}

export interface EntityValue {
  /** Apply the values of variables in this result object. */
  applyResult(result: any): void;
  /** Create a JS data object conforming to the OData output format. */
  serializeToODataJson(): any;
}

export class EntityCollection implements EntityValue {
  private context: QueryContext;
  private kind: Schema.EntityKind;
  private entities: { [id: string]: EntityValue } = {};

  constructor(context: QueryContext, kind: Schema.EntityKind) {
    this.context = context;
    this.kind = kind;
  }

  ///
  public applyResult(result: any): void {

    let id = this.context.getUniqueIdOfResult(result);
    if (!Object.prototype.hasOwnProperty.call(this.entities, id)) {

      this.entities[id] = EntityFactory.fromEntityKind(this.kind, this.context);
    }

    this.entities[id].applyResult(result);
  }

  public serializeToODataJson() {
    return Object.keys(this.entities).map(id => this.entities[id].serializeToODataJson());
  }
}

export class ComplexEntity implements EntityValue {
  private context: QueryContext;
  private value: { [id: string]: EntityValue } = undefined;
  private id: any;

  constructor(context: QueryContext) {
    this.context = context;
  }

  public applyResult(result: any): void {
    let resultId = this.context.getUniqueIdOfResult(result);
    let firstResultOrSameId = this.id === undefined || resultId === this.id;

    if (firstResultOrSameId) {
      if (this.value === undefined) {
        this.initializeWithId(resultId);
      }
      this.context.forEachPropertyOfResult(result, (resultOfProperty, property, hasValueInResult) => {
        this.applyResultToProperty(resultOfProperty, property, hasValueInResult);
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
      let entity = this.getPropertyEntity(property);
      let entityExists = this.hasPropertyEntity(property);
      serialized[propertyName] = entityExists ? entity.serializeToODataJson() : null;
    };

    this.context.forEachPropertySchema(serializeProperty);

    return serialized;
  }

  private initializeWithId(id) {
    this.id = id;
    this.value = {};
  }

  private applyResultToProperty(result: any, property: Schema.Property, hasValueInResult: boolean) {
    if (!this.hasPropertyEntity(property)) {
      this.setPropertyEntity(property,
        EntityFactory.fromPropertyWithContext(property, this.context));
    }

    if (hasValueInResult) this.value[property.getName()].applyResult(result);
  }

  private hasPropertyEntity(property: Schema.Property) {
    return this.getPropertyEntity(property) !== undefined;
  }

  private getPropertyEntity(property: Schema.Property) {
    return this.value[property.getName()];
  }

  private setPropertyEntity(property: Schema.Property, value) {
    this.value[property.getName()] = value;
  }
}

export class ElementaryEntity implements EntityValue {
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

export class EntityFactory {
  public static fromPropertyWithContext(property: Schema.Property, context: QueryContext): EntityValue {
    let kind = property.getEntityKind();
    let subContext = context.getSubContext(property.getName());
    if (property.isCardinalityOne()) {
      return EntityFactory.fromEntityKind(kind, subContext);
    }
    else {
      return new EntityCollection(subContext, kind);
    }
  }

  public static fromEntityKind(kind: Schema.EntityKind, context: QueryContext): EntityValue {
    switch (kind) {
      case Schema.EntityKind.Elementary:
        return new ElementaryEntity();
      case Schema.EntityKind.Complex:
        return new ComplexEntity(context);
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
  /** Iterate over all properties and pass their value respective subResult. */
  forEachPropertyOfResult(result, fn: (value, property: Schema.Property, hasValue: boolean) => void): void;

  forEachPropertySchema(fn: (property: Schema.Property) => void): void;
  forEachElementaryPropertySchema(fn: (property: Schema.Property) => void): void;
  forEachComplexPropertySchema(fn: (property: Schema.Property) => void): void;

  getUniqueIdOfResult(result): string;
  getSubContext(property: string): QueryContext;
}
