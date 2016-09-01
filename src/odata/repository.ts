import schema = require("./schema");
import { IValue } from "./filterexpressions";
import results = require("../result");

export interface IRepository<TVisitor> {
  getEntities(entityType: schema.EntityType, expandTree: any, filterTree: IValue<TVisitor>,
              cb: (result: results.Result<any[], any>) => void): void;
  insertEntity(entity: any, type: schema.EntityType, cb: (result: results.AnyResult) => void): void;
}
