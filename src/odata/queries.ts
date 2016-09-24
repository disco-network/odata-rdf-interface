import Schema = require("./schema");
import { IValue } from "./filters/expressions";

export interface IQuery {
  run(sparqlProvider, cb: (result) => void): void;
}

export interface IQueryModel<TExpressionVisitor> {
  entitySetType: Schema.EntityType;
  filterOption?: IValue<TExpressionVisitor>;
  expandTree: any;
}
