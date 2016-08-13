import schema = require("./schema");
import results = require("../result");

export interface IRepository {
  getEntities(entityType: schema.EntityType, expandTree: any, filterTree: any,
              cb: (result: results.Result<any[], any>) => void): void;
  insertEntity(entity: any, type: schema.EntityType, cb: (result: results.AnyResult) => void): void;
}
