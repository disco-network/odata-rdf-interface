import schema = require("./schema");

export interface IEntityReader {
  fromJson(json: string, entityType: schema.EntityType): any;
}
