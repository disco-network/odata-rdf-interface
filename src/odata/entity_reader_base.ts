import schema = require("./schema");

import { IOperation } from "./repository";

/**
 * Receives an entity with the properties specified in the request and
 * validates and initializes all properties of the specified type.
 */
export interface IEntityInitializer {
  fromParsed(entity: any, entityType: schema.EntityType): ReadonlyArray<IOperation>;
}
