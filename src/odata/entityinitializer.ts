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

export class EntityDiffInitializer implements base.IEntityDiffInitializer {
  private resolver = new ForeignKeyPropertyResolver();

  constructor(private edmConverter: IEdmConverter) {}

  public fromParsed(entity: ParsedEntity, entityType: EntityType, pattern: ParsedEntity) {

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

  private buildBatchPlanCheckPropertyConstraints(assignments: PropertyAssignments, type: EntityType,
                                                 pattern: ParsedEntity) {
    const identifier = uuid.v4().replace(/-/g, ""); // hopefully this produces an unique identifier
    const batchPlanPrerequisites: IOperation[] = [];
    const insertedValues = {} as BatchEntity & OnlyExistingPropertiesBrand & CorrectPropertyTypesBrand;

    this.forEachPropertyInType(type, property => {
      try {
        if (canPropertyBeAssignedByUser(property) === false && isPropertyAssignedByUser(property) === true) {
          throw new BadBodyError(`Cannot assign this property: ${property.getName()}`);
        }
        if (property.isGenerated()) {
          const method = property.getGenerationMethod();
          switch (method) {
            case GenerationMethod.UUID:
              this.convertAndAssignPropertyOnce(property, insertedValues, { type: "Edm.Guid", value: identifier });
              break;
            case GenerationMethod.AutoIncrement:
              this.convertAndAssignPropertyOnce(property, insertedValues,
                                                { type: "Edm.String", value: property.genNextAutoIncrementValue() });
              break;
            default:
              shouldNotBeReached(method, `Unexpected property generation method: ${method}`);
          }
        }
        else if (shouldPropertyHaveValueOrNull(property) && isPropertyAssignedByUser(property)) {
          const userAssignedValue = getUserAssignedValue(property);

          switch (userAssignedValue.type) {
            case "ref":
              this.assignEntityReference(property, insertedValues, userAssignedValue, batchPlanPrerequisites);
              break;
            default:
              this.convertAndAssignPropertyOnce(property, insertedValues, userAssignedValue);
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

    function getUserAssignedValue(property: Property & { __assignedBrand }): EdmLiteral | EntityRef;
    function getUserAssignedValue(property: Property): EdmLiteral | EntityRef | undefined;
    function getUserAssignedValue(property: Property): EdmLiteral | EntityRef | undefined {
      return isPropertyAssignedByUser(property) ? assignments[property.getName()] : undefined;
    }

    function isPropertyAssignedByUser(property: Property): property is Property & { __assignedBrand } {
      return Object.prototype.hasOwnProperty.call(assignments, property.getName()) === true;
    }

    function canPropertyBeAssignedByUser(property: Property) {
      return shouldPropertyHaveValueOrNull(property) === true
        || property.isGenerated() === true;
    }

    function shouldPropertyHaveValueOrNull(property: Property) {
      return property.isCardinalityOne() === true && property.foreignProperty() === undefined;
    }
  }

  private assignPropertyOnce<T extends EdmLiteral | IBatchReference | EntityRef>(property: Property, entity: Entity<T>,
                                                                                 value: T) {
    if (Object.prototype.hasOwnProperty.call(entity, property.getName())) {
      throw new BadBodyError(`Strangely, property ${property.getName()} was inserted twice.`);
    }
    else {
      entity[property.getName()] = value;
    }
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
    this.assignPropertyOnce(property, entity, this.edmConverter.convert(value, property.getEntityType().getName(),
                                                                        property.isOptional()));
  }

  private isPropertySpecifiedIn(property: Property, entity: Entity<EdmLiteral>) {
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

export class EntityInitializer implements base.IEntityInitializer {
  private resolver = new ForeignKeyPropertyResolver();

  constructor(private edmConverter: IEdmConverter) {}

  public fromParsed(entity: ParsedEntity, entityType: EntityType) {

    const assignedProperties = this.assignParsedPropertiesCheckPropertyExistence(entity, entityType);
    return this.buildBatchPlanCheckPropertyConstraints(assignedProperties, entityType);
  }

  private assignParsedPropertiesCheckPropertyExistence(entity: ParsedEntity, entityType: EntityType) {
    const ret: PropertyAssignments = {};

    for (const propertyName of Object.keys(entity)) {
      /* @todo check existence of property */
      const property = entityType.getProperty(propertyName);
      const value = entity[propertyName]!;
      const setter = this.resolver.resolveSetter(property, value);
      const setterValue = setter.value;
      switch (setterValue.type) {
        case "ref":
          const referredComplexProperty = setter.property;
          assignProperty(referredComplexProperty.getName(), {
            type: "ref",
            entityType: referredComplexProperty.getEntityType(),
            idProperty: setterValue.indexProperty,
            id: setterValue.id,
          });
          break;
        default:
          assignProperty(propertyName, setterValue);
      }
    }

    return ret;

    function assignProperty(propertyName: string, value: EdmLiteral | EntityRef) {
      if (Object.prototype.hasOwnProperty.call(ret, propertyName)) {
        throw new BadBodyError(`Trying to assign the same property (${propertyName}) twice`);
      }
      else {
        ret[propertyName] = value;
      }
    }
  }

  private buildBatchPlanCheckPropertyConstraints(assignments: PropertyAssignments, type: EntityType) {
    const that = this;
    const identifier = uuid.v4().replace(/-/g, ""); // hopefully this produces an unique identifier
    const batchPlanPrerequisites: IOperation[] = [];
    const insertedValues: { [prop: string]: EdmLiteral | IBatchReference } = {};
    for (const propertyName of type.getPropertyNames()) {
      const property = type.getProperty(propertyName);
      if (canPropertyBeAssigned(property) === false) {
        if (isPropertyAssignedByUser(property) === true) {
          throw new BadBodyError(`Cannot assign this property: ${propertyName}`);
        }
      }
      if (property.isGenerated()) {
        const method = property.getGenerationMethod();
        switch (method) {
          case GenerationMethod.UUID:
            insertLiteral(property, { type: "Edm.Guid", value: identifier });
            break;
          case GenerationMethod.AutoIncrement:
            insertLiteral(property, { type: "Edm.String", value: property.genNextAutoIncrementValue() });
            break;
          default:
            shouldNotBeReached(method, "Unexpected property generation method: " + method);
        }
      }
      else {
        if (shouldPropertyHaveValueOrNull(property)) {
          const userAssignedValue = isPropertyAssignedByUser(property)
            ? getUserAssignedValue(property)
            : getNullValue();

          switch (userAssignedValue.type) {
            case "ref":
              insertReference(property, userAssignedValue);
              break;
            default:
              insertLiteral(property, userAssignedValue);
          }
        }
      }
    }

    return batchPlanPrerequisites.concat([{
      type: "insert",
      entityType: type.getName(),
      identifier: identifier,
      value: insertedValues,
    }]) as ReadonlyArray<IOperation>;

    function insertReference(property: Property, value: EntityRef) {
      batchPlanPrerequisites.push({
        type: "get",
        entityType: value.entityType.getName(),
        pattern: { [value.idProperty.getName()]: value.id },
      });
      /* @todo checks */
      insertValueNoChecks(property, { type: "ref", resultIndex: batchPlanPrerequisites.length - 1 });
    }

    function insertLiteral(property: Property, value: EdmLiteral) {
      try {
        insertValueNoChecks(property, that.edmConverter.convert(value, property.getEntityType().getName(),
          property.isOptional()));
      }
      catch (e) {
        if (e instanceof InvalidConversionError)
          throw new BadBodyError(`Property ${property.getName()} - conversion error: ${e.message}`);
        else throw e;
      }
    }

    function insertValueNoChecks(property: Property, value: EdmLiteral | IBatchReference) {
      if (Object.prototype.hasOwnProperty.call(insertedValues, property.getName()) === true)
        throw new Error(`Strangely, property ${property.getName()} was inserted twice.`);
      else insertedValues[property.getName()] = value;
    }

    function getUserAssignedValue(property: Property & { __assignedBrand }): EdmLiteral | EntityRef;
    function getUserAssignedValue(property: Property): EdmLiteral | EntityRef | undefined;
    function getUserAssignedValue(property: Property): EdmLiteral | EntityRef | undefined {
      return isPropertyAssignedByUser(property) ? assignments[property.getName()] : undefined;
    }

    function getNullValue(): EdmLiteral {
      return { type: "null" };
    }

    function isPropertyAssignedByUser(property: Property): property is Property & { __assignedBrand } {
      return Object.prototype.hasOwnProperty.call(assignments, property.getName()) === true;
    }

    function canPropertyBeAssigned(property: Property) {
      return shouldPropertyHaveValueOrNull(property) === true
        || property.isGenerated() === true;
    }

    function shouldPropertyHaveValueOrNull(property: Property) {
      return property.isCardinalityOne() === true && property.foreignProperty() === undefined;
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
