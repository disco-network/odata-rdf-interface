import { shouldNotBeReached } from "../controlflow";

import * as base from "./entityinitializer_base";
import { EntityType, Property, GenerationMethod } from "./schema";
import * as uuid from "uuid";
import {
  IOperation, IBatchReference,
  OnlyExistingPropertiesBrand, CorrectPropertyTypesBrand, BatchEntity, Entity,
} from "./repository";
import { ParsedEntity } from "./parser";
import { EdmLiteral, IEdmConverter, InvalidConversionError } from "./edm";
import { ForeignKeyPropertyResolver } from "./foreignkeyproperties";

export class EntityInitializer implements base.IEntityInitializer {
  private resolver = new ForeignKeyPropertyResolver();

  constructor(private edmConverter: IEdmConverter) {}

  public insertionFromParsed(entity: ParsedEntity, entityType: EntityType) {
    const that = this;

    const assignedProperties = this.assignParsedPropertiesCheckPropertyExistence(entity, entityType);
    return buildBatchPlanCheckPropertyConstraints(assignedProperties, entityType);

    function buildBatchPlanCheckPropertyConstraints(assignments: PropertyAssignments, type: EntityType) {

      const identifier = uuid.v4().replace(/-/g, ""); // hopefully this produces an unique identifier
      const batchPlanPrerequisites: IOperation[] = [];
      const insertedValues: { [prop: string]: EdmLiteral | IBatchReference } = {};

      that.forEachPropertyInType(type, property => {
        try {
          that.throwOnIllegalUserAssignment(property, assignments);
          if (property.isGenerated()) {
            const method = property.getGenerationMethod();
            const value = that.generateValue(method, property, identifier);
            that.convertAndAssignPropertyOnce(property, insertedValues, value);
          }
          else if (that.shouldPropertyHaveValueOrNull(property)) {
            const userAssignedValue = that.isPropertyAssignedByUser(property, assignments)
              ? that.getUserAssignedValue(property, assignments)
              : getNullValue();

            switch (userAssignedValue.type) {
              case "ref":
                that.assignEntityReference(property, insertedValues, userAssignedValue, batchPlanPrerequisites);
                break;
              default:
                that.convertAndAssignPropertyOnce(property, insertedValues, userAssignedValue);
            }
          }
        }
        catch (e) {
          if (e instanceof InvalidConversionError)
            catchInvalidConversion(property, e);
          else throw e;
        }
      });

      return batchPlanPrerequisites.concat([{
        type: "insert",
        entityType: type.getName(),
        identifier: identifier,
        value: insertedValues,
      }]) as ReadonlyArray<IOperation>;

      function catchInvalidConversion(property: Property, e: InvalidConversionError) {
        throw new BadBodyError(`Property ${property.getName()} - conversion error: ${e.message}`);
      }

      function getNullValue(): EdmLiteral {
        return { type: "null" };
      }
    }
  }

  public patchFromParsed(entity: ParsedEntity, entityType: EntityType, pattern: ParsedEntity) {

    const assignedProperties = this.assignParsedPropertiesCheckPropertyExistence(entity, entityType);
    return this.buildBatchPlanCheckPropertyConstraints(assignedProperties, entityType, pattern);
  }

  /**
   * conditions:
   * * all specified properties exist in "entityType"
   * 
   * actions:
   * * convert property values to the required entity type
   */
  private convertAndValidatePattern(pattern: ParsedEntity, entityType: EntityType) {

    const that = this;

    return convertValuesToMatchProperties(
             resolveAndDisallowForeignKeyProperties(
               verifyPropertyExistence(pattern)));

    function verifyPropertyExistence(entity: Entity<EdmLiteral>) {
      return that.onlyExistingPropertiesOrThrow(pattern, entityType);
    }

    function resolveAndDisallowForeignKeyProperties(entity: Entity<EdmLiteral> & OnlyExistingPropertiesBrand) {
      const assignments = {} as Entity<EdmLiteral> & OnlyExistingPropertiesBrand;
      that.forEachProperty(entity, entityType, (prop, value) => {
        const setter = that.resolver.resolveSetter(prop, pattern[prop.getName()]);
        const setterValue = setter.value;
        switch (setterValue.type) {
          case "ref":
            throw new Error(`Pattern illegally contains foreign-key property ${prop.getName()}`);
          default:
            that.assignPropertyOnce(prop, assignments, setterValue);
        }
      });
      return assignments;
    }

    function convertValuesToMatchProperties(entity: Entity<EdmLiteral> & OnlyExistingPropertiesBrand) {
      const validated = {} as Entity<EdmLiteral> & OnlyExistingPropertiesBrand & CorrectPropertyTypesBrand;
      that.forEachPropertyInType(entityType, property => {
        if (that.isPropertySpecifiedIn(property, entity)) {
          that.assignPropertyOnce(property, validated,
                        that.convertToPropertyType(property, that.propertyValue(property, entity)));
        }
      });
      return validated;
    }
  }

  /**
   * conditions:
   * * all specified properties exist in "entityType"
   * 
   * actions:
   * * convert property values to the required entity type
   */
  private assignParsedPropertiesCheckPropertyExistence(entity: Entity<EdmLiteral>, entityType: EntityType) {
    const ret: PropertyAssignments = {};

    /* @construction create class to store entityType -> no redundant arguments */
    this.forEachProperty(this.onlyExistingPropertiesOrThrow(entity, entityType), entityType, (property, value) => {
      const setter = this.resolver.resolveSetter(property, value);
      const setterValue = setter.value;
      switch (setterValue.type) {
        case "ref":
          const referredComplexProperty = setter.property;
          this.assignPropertyOnce(referredComplexProperty, ret, {
            type: "ref",
            entityType: referredComplexProperty.getEntityType(),
            idProperty: setterValue.indexProperty,
            id: setterValue.id,
          });
          break;
        default:
          this.assignPropertyOnce(property, ret, setterValue);
      }
    });

    return ret;
  }

  private getValueToAssign(property: Property, uuidIdentifier: string, assignments: PropertyAssignments,
                           getUserAssignedValue: (property: Property, assignments) => EdmLiteral | EntityRef) {
    this.throwOnIllegalUserAssignment(property, assignments);
    if (property.isGenerated()) {
      const method = property.getGenerationMethod();
      return this.generateValue(method, property, uuidIdentifier);
    }
    else if (this.shouldPropertyHaveValueOrNull(property) && this.isPropertyAssignedByUser(property, assignments)) {
      return getUserAssignedValue(property, assignments);
    }
    else return undefined;
  }

  private buildBatchPlanCheckPropertyConstraints(assignments: PropertyAssignments, type: EntityType,
                                                 pattern: ParsedEntity) {
    const identifier = uuid.v4().replace(/-/g, ""); // hopefully this produces an unique identifier
    const batchPlanPrerequisites: IOperation[] = [];
    const insertedValues = {} as BatchEntity & OnlyExistingPropertiesBrand & CorrectPropertyTypesBrand;

    this.forEachPropertyInType(type, property => {
      try {
        const valueToAssign = this.getValueToAssign(property, identifier, assignments,
                                                    this.getUserAssignedValue.bind(this));
        if (valueToAssign !== undefined) {
          switch (valueToAssign.type) {
            case "ref":
              this.assignEntityReference(property, insertedValues, valueToAssign, batchPlanPrerequisites);
              break;
            default:
              this.convertAndAssignPropertyOnce(property, insertedValues, valueToAssign);
          }
        }
      }
      catch (e) {
        if (e instanceof InvalidConversionError)
          catchInvalidConversion(property, e);
        else throw e;
      }
    });

    return batchPlanPrerequisites.concat([{
      type: "patch",
      entityType: type.getName(),
      pattern: this.convertAndValidatePattern(pattern, type),
      diff: insertedValues,
    }]) as ReadonlyArray<IOperation>;

    function catchInvalidConversion(property: Property, e: InvalidConversionError) {
      throw new BadBodyError(`Property ${property.getName()} - conversion error: ${e.message}`);
    }
  }

  private assignPropertyOnce<T extends EdmLiteral | IBatchReference | EntityRef>(property: Property, entity: Entity<T>,
                                                                                 value: T) {
    if (this.isPropertySpecifiedIn(property, entity)) {
      throw new BadBodyError(`Strangely, property ${property.getName()} was inserted twice.`);
    }
    else {
      entity[property.getName()] = value;
    }
  }

  /// unordered

  private getUserAssignedValue(property: Property & { __assignedBrand },
                               entity: Entity<EdmLiteral | EntityRef>): EdmLiteral | EntityRef;
  private getUserAssignedValue(property: Property,
                               entity: Entity<EdmLiteral | EntityRef>): EdmLiteral | EntityRef | undefined;
  private getUserAssignedValue(property: Property,
                               entity: Entity<EdmLiteral | EntityRef>): EdmLiteral | EntityRef | undefined {
    return this.isPropertyAssignedByUser(property, entity) ? entity[property.getName()] : undefined;
  }

  private isPropertyAssignedByUser(property: Property,
                                   entity: Entity<EdmLiteral | EntityRef>): property is Property & { __assignedBrand } {
    return this.isPropertySpecifiedIn(property, entity);
  }

  /// policy

  private throwOnIllegalUserAssignment(property: Property, assignments: PropertyAssignments) {
    if (this.canPropertyBeAssignedByUser(property) === false
        && this.isPropertyAssignedByUser(property, assignments) === true) {
      throw new BadBodyError(`Cannot assign this property: ${property.getName()}`);
    }
  }

  private generateValue(method: GenerationMethod, property: Property, uuidIdentifier: string): EdmLiteral {
    switch (method) {
      case GenerationMethod.UUID:
        return { type: "Edm.Guid", value: uuidIdentifier };
      case GenerationMethod.AutoIncrement:
        return { type: "Edm.String", value: property.genNextAutoIncrementValue() };
      default:
        return shouldNotBeReached(method, `Unexpected property generation method: ${method}`);
    }
  }

  private canPropertyBeAssignedByUser(property: Property) {
    return this.shouldPropertyHaveValueOrNull(property) === true
      || property.isGenerated() === true;
  }

  private shouldPropertyHaveValueOrNull(property: Property) {
    return property.isCardinalityOne() === true && property.foreignProperty() === undefined;
  }

  /// entity logic

  private assignEntityReference(property: Property, entity: BatchEntity, value: EntityRef,
                                prerequisites: IOperation[]) {
    prerequisites.push({
      type: "get",
      entityType: value.entityType.getName(),
      pattern: { [value.idProperty.getName()]: value.id },
    });
    /* @todo checks */
    this.assignPropertyOnce(property, entity, { type: "ref", resultIndex: prerequisites.length - 1 });
  }

  private convertAndAssignPropertyOnce(property: Property,
                                       entity: Entity<any>,
                                       value: EdmLiteral) {
    this.assignPropertyOnce(property, entity, this.convertToPropertyType(property, value));
  }

  private isPropertySpecifiedIn(property: Property, entity: Entity<any>) {
    return Object.prototype.hasOwnProperty.call(entity, property.getName());
  }

  private propertyValue(property: Property, entity: Entity<EdmLiteral>) {
    return entity[property.getName()];
  }

  private forEachProperty<T extends EdmLiteral | IBatchReference>(entity: Entity<T> & OnlyExistingPropertiesBrand,
                                                                  type: EntityType,
                                                                  fn: (property: Property, value: T) => void) {
    for (const propertyName of Object.keys(entity)) {
      fn(type.getProperty(propertyName), entity[propertyName]);
    }
  }

  private onlyExistingPropertiesOrThrow<T extends EdmLiteral | IBatchReference>(entity: Entity<T>, type: EntityType) {

    for (const propertyName of Object.keys(entity)) {
      if (type.getProperty(propertyName) === undefined)
        throw new Error(`Property ${propertyName} does not exist in type ${type.getName()}`);
    }
    return entity as Entity<T> & OnlyExistingPropertiesBrand;
  }

  /// conversion

  private convertToPropertyType(property: Property, value: EdmLiteral) {
    return this.edmConverter.convert(value, property.getEntityType().getName(), property.isOptional());
  }

  ///

  private forEachPropertyInType(type: EntityType, fn: (prop: Property) => void) {
    for (const name of type.getPropertyNames()) {
      fn(type.getProperty(name));
    }
  }
}

export interface PropertyAssignments {
  [property: string]: EdmLiteral | EntityRef;
}

export interface EntityRef {
  type: "ref";
  entityType: EntityType;
  idProperty: Property;
  id: EdmLiteral;
}

export class BadBodyError extends Error {
  constructor(message = "BadBodyError") {
    super();
    this.message = message;
  }
}
