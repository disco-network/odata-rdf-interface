import { EntityType } from "./schema";

import { IOperation } from "./repository";
import { ParsedEntity } from "./parser";

/**
 * Takes a parsed entity and
 * initializes, validates and converts all properties according to its entity type.
 */
export interface IEntityInitializer {
  fromParsed(entity: any, entityType: EntityType): ReadonlyArray<IOperation>;
}

/**
 * Takes a parsed entity and
 * validates and converts all specified properties according to its entity type.
 */
export interface IEntityDiffInitializer {
  fromParsed(entity: ParsedEntity, entityType: EntityType, pattern: ParsedEntity): ReadonlyArray<IOperation>;
}
