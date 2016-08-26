import * as contract from "../contract";

export interface IType {

}

export interface ElementaryType {
  name: string;
}

export interface IValue {
  getType(): IType;
}

export interface IValueHandler<TSupportedValue extends IValue, ReturnValue> {
  handle(value: TSupportedValue): ReturnValue;
}

export let IStringLiteralExpression = contract.define<IStringLiteralExpression>();
export interface IStringLiteralExpression extends IValue {
  getValue(): string;
}

export type ValueKind = string | symbol;
