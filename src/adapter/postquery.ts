import schema = require("../odata/schema");

export interface QueryStringBuilder {
  build(entity: any, type: schema.EntityType);
}
