import schema = require("../odata/schema");

export interface IQueryStringBuilder {
  build(entity: any, type: schema.EntityType): string;
}

export class QueryStringBuilder {
  public build(entity: any, type: schema.EntityType): string {
    return "";
  }
}
