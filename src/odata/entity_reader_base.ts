import schema = require("./schema");

export interface EntityReaderBase {
  fromJson(json: string, entityType: schema.EntityType): any;
}
