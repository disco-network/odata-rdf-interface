import * as contract from "../contract";

export interface IValueHandler<TWrapValue extends IWrapValue<TWrapValue>, Return> {
  handle(value: TWrapValue): Return;
}

export interface IValue<TWrapper extends IWrapValue<TWrapper>> {
}

export let IStringLiteral
  = contract.defineGeneric<(<T extends IWrapValue<T>>(x: IValue<T>) => x is IStringLiteral<T>)>();
export interface IStringLiteral<TWrapValue extends IWrapValue<TWrapValue>> extends IValue<TWrapValue> {
  getValue(): string;
}

export let IOrExpression
  = contract.defineGeneric<(<T extends IWrapValue<T>>(x: IValue<T>) => x is IOrExpression<T>)>();
export interface IOrExpression<TWrapValue extends IWrapValue<TWrapValue>> extends IValue<TWrapValue> {
  getLhs(): TWrapValue;
  getRhs(): TWrapValue;
}

export interface IWrapValue<Self extends IWrapValue<Self>> {
  getValue(): IValue<IWrapValue<Self>>;
}
