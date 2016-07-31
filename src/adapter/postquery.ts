import schema = require("../odata/schema");

export interface QueryStringBuilderBase {
  build(entity: any, type: schema.EntityType): string;
}
