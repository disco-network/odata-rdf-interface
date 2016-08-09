import base = require("./entity_reader_base");
import schema = require("./schema");

export class EntityReader implements base.IEntityReader {
  public fromJson(json: string, entityType: schema.EntityType): any {
    let object = JSON.parse(json);
    for (let propertyName of entityType.getPropertyNames()) {
      if (Object.prototype.hasOwnProperty.call(object, propertyName) === false) {
        let property = entityType.getProperty(propertyName);
        if (property.isAutoIncrementable()) {
          object[propertyName] = property.genNextAutoIncrementValue();
        }
      }
    }
    return object;
  }
}
