import * as base from "./entity_reader_base";
import * as schema from "./schema";
import * as uuid from "uuid";
import { IOperation } from "./repository";
import { ForeignKeyPropertyResolver, Value, Ref } from "./foreignkeyproperties";

export class EntityInitializer implements base.IEntityInitializer {
  private resolver = new ForeignKeyPropertyResolver();

  public fromParsed(entity: any, entityType: schema.EntityType) {
    const prerequisites: IOperation[] = [];
    const object = {};
    const identifier = uuid.v4().replace(/-/g, ""); // hopefully this produces an unique identifier
    for (let propertyName of entityType.getPropertyNames()) {
      const property = entityType.getProperty(propertyName);

      if (property.isGenerated() === true) {
        if (property.isGeneratedUUID()) {
          object[propertyName] = identifier;
        }
        else if (property.isAutoIncrementable()) {
          object[propertyName] = property.genNextAutoIncrementValue();
        }
      }
      else if (Object.prototype.hasOwnProperty.call(entity, propertyName)) {
        const setter = this.resolver.resolveSetter(entityType.getProperty(propertyName), entity[propertyName]);
        const setterValue = setter.value;
        const propertyType = setter.property.getEntityType();
        if (this.isRef(setterValue)) {
          prerequisites.push({
            type: "get",
            entityType: propertyType.getName(),
            pattern: {
              [setterValue.indexProperty.getName()]: setterValue.id,
            },
          });
          object[setter.property.getName()] = { type: "ref", resultIndex: prerequisites.length - 1 };
        }
        else {
          object[setter.property.getName()] = setterValue.value;
        }
      }
    }

    return prerequisites.concat([{
      type: "insert",
      entityType: entityType.getName(),
      identifier: identifier,
      value: object,
    }]);
  }

  private isRef(value: Value | Ref): value is Ref {
    return value.type === "ref";
  }
}
