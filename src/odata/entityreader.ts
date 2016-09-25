import * as base from "./entity_reader_base";
import { EntityType } from "./schema";
import * as uuid from "uuid";
import { IOperation } from "./repository";
import { ParsedEntity } from "./parser";
import { EdmLiteral, EdmConverter } from "./edm";
import { ForeignKeyPropertyResolver, Ref as ForeignKeyRef, SetterValue } from "./foreignkeyproperties";

export class EntityInitializer implements base.IEntityInitializer {
  private resolver = new ForeignKeyPropertyResolver();

  constructor(private edmConverter: EdmConverter) {}

  public fromParsed(entity: ParsedEntity, entityType: EntityType) {
    const prerequisites: IOperation[] = [];
    const object: { [id: string]: EdmLiteral | Ref } = {};
    const identifier = uuid.v4().replace(/-/g, ""); // hopefully this produces an unique identifier
    for (let propertyName of entityType.getPropertyNames()) {
      const property = entityType.getProperty(propertyName);

      if (property.isGenerated() === true) {
        if (property.isGeneratedUUID()) {
          object[propertyName] = this.edmConverter.convert({ type: "Edm.Guid", value: identifier },
                                                           property.getEntityType().getName());
        }
        else if (property.isAutoIncrementable()) {
          object[propertyName] = this.edmConverter.convert({ type: "Edm.String",
                                                             value: property.genNextAutoIncrementValue() },
                                                           property.getEntityType().getName());
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
          object[setter.property.getName()] = this.edmConverter.convert(setterValue,
                                                                        property.getEntityType().getName());
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

  private isRef(value: SetterValue): value is ForeignKeyRef {
    return value.type === "ref";
  }
}

export interface Ref {
  type: "ref";
  resultIndex: number;
}
