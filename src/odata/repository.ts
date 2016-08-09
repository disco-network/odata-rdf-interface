import schema = require("./schema");
import results = require("../result");

export interface IRepository {
  insertEntity(entity: any, type: schema.EntityType, cb: (result: results.AnyResult) => void): void;
}
