import { EntityType } from "./schema";

import { IOperation } from "./repository";
import { ParsedEntity } from "./parser";

/**
 * Takes a parsed entity and
 * initializes, validates and converts all properties according to its entity type.
 */
export interface IEntityInitializer {
  insertionFromParsed(entity: ParsedEntity, entityType: EntityType): ReadonlyArray<IOperation>;
  patchFromParsed(entity: ParsedEntity, entityType: EntityType, pattern: ParsedEntity): ReadonlyArray<IOperation>;
}
