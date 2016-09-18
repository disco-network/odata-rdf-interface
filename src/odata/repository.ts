import schema = require("./schema");
import { IValue } from "./filters/expressions";
import results = require("../result");

export interface IRepository<TVisitor> {
  getEntities(entityType: schema.EntityType, expandTree: any, filterTree: IValue<TVisitor>,
              cb: (result: results.Result<any[], any>) => void): void;
  /* @deprecated */ insertEntity(entity: any, type: schema.EntityType, cb: (result: results.AnyResult) => void): void;
  batch(ops: IOperation[], schema: schema.Schema, cb: (results: results.AnyResult) => void);
}

export type IOperation = IGetOperation | IInsertOperation;
export type IPrimitive = string | number;

export interface IGetOperation {
  type: "get";
  entityType: string;
  pattern: { [id: string]: IPrimitive };
}

export interface IInsertOperation {
  type: "insert";
  entityType: string;
  value: { [id: string]: IPrimitive | IReference };
}

export interface IReference {
  type: "ref";
  resultIndex: number;
}
