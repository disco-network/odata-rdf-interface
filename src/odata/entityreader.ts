import base = require("./entity_reader_base");
import schema = require("./schema");

export class EntityReader implements base.IEntityInitializer {
  public fromParsed(entity: any, entityType: schema.EntityType): any {
    let object = {};
    for (let propertyName of entityType.getPropertyNames()) {
      if (Object.prototype.hasOwnProperty.call(entity, propertyName)) {
        object[propertyName] = entity[propertyName];
      }
      else {
        let property = entityType.getProperty(propertyName);
        if (property.isAutoIncrementable()) {
          object[propertyName] = property.genNextAutoIncrementValue();
        }
      }
    }
    return object;
  }
}
