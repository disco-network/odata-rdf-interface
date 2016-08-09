import schema = require("./schema");

/**
 * Parses the request body containing an entity in JSON format and
 * validates and initializes all properties of the specified type.
 */
export interface IEntityReader {
  fromJson(json: string, entityType: schema.EntityType): any;
}
