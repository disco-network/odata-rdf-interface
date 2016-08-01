import schema = require("../odata/schema");

export interface QueryStringBuilderBase {
  build(entity: any, type: schema.EntityType): string;
}

export class QueryStringBuilder {
  public build(entity: any, type: schema.EntityType): string {
    return "";
  }
}
