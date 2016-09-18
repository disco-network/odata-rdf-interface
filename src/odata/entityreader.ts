import base = require("./entity_reader_base");
import schema = require("./schema");
import { ForeignKeyPropertyResolver, Value, Ref } from "./foreignkeyproperties";

export class EntityReader implements base.IEntityInitializer {
  private resolver = new ForeignKeyPropertyResolver();

  public fromParsed(entity: any, entityType: schema.EntityType): any[] {
    let prerequisites = [];
    let object = {};
    for (let propertyName of entityType.getPropertyNames()) {
      if (Object.prototype.hasOwnProperty.call(entity, propertyName)) {
        const setter = this.resolver.resolveSetter(entityType.getProperty(propertyName), entity[propertyName]);
        const setterValue = setter.value;
        if (this.isRef(setterValue)) {
          prerequisites.push({
            type: "get",
            entityType: entityType.getName(),
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
      else {
        let property = entityType.getProperty(propertyName);
        if (property.isAutoIncrementable()) {
          object[propertyName] = property.genNextAutoIncrementValue();
        }
      }
    }

    return prerequisites.concat([{
      type: "insert",
      value: object,
    }]);
  }

  private isRef(value: Value | Ref): value is Ref {
    return value.type === "ref";
  }
}
