import schema = require("./schema");
import { EdmLiteral } from "./edm";
import { IValue } from "./filters/expressions";
import results = require("../result");

export interface IRepository<TVisitor> {
  getEntities(entityType: schema.EntityType, expandTree: any, filterTree: IValue<TVisitor> | undefined,
              cb: (result: results.Result<any[], any>) => void): void;
  /* @deprecated */ insertEntity(entity: any, type: schema.EntityType, cb: (result: results.AnyResult) => void): void;
  batch(ops: ReadonlyArray<IOperation>, schema: schema.Schema, cb: (results: results.AnyResult) => void);
}

export type IOperation = IGetOperation | IInsertOperation | IPatchOperation;

export interface IGetOperation {
  type: "get";
  entityType: string;
  pattern: { [id: string]: EdmLiteral };
}

export interface IInsertOperation {
  type: "insert";
  entityType: string;
  identifier: string;
  value: { [id: string]: EdmLiteral | IBatchReference };
}

export interface IPatchOperation {
  type: "patch";
  entityType: string;
  pattern: Entity & OnlyExistingPropertiesBrand & CorrectPropertyTypesBrand;
  diff: BatchEntity & OnlyExistingPropertiesBrand & CorrectPropertyTypesBrand;
}

export interface IBatchReference {
  type: "ref";
  resultIndex: number;
}

export interface BatchEntity {
  [property: string]: EdmLiteral | IBatchReference;
}

export interface Entity {
  [property: string]: EdmLiteral;
}

export enum OnlyExistingPropertiesBrand {}
export enum AllPropertiesBrand {}
export enum CorrectPropertyTypesBrand {}
