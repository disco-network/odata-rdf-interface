import schema = require("./schema");

export interface IEntityReaderBase {
  fromJson(json: string, entityType: schema.EntityType): any;
}
