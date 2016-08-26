import * as contract from "../contract";

/*
 * IValueHandlers should be able to restrict the subtypes of IValues to handle.
 * This should be enforced by the type checker.
 * To ensure type checking, it seems that we need lots of recursive generic interface definitions
 * which turn out to have similarities with the so-called Curiously Recurring Template Pattern.
 * 
 * In order to use this module we first need to recursively define a helper object, for example:
 *
 *  type AllowedValues = IOrExpression<MyValueWrapper> | IStringLiteral<MyValueWrapper>;
 *  class MyValueWrapper implements IWrapValue<MyValueWrapper> {
 *    constructor(private value: AllowedValues) {}
 *    public getValue(): AllowedValues {
 *      return this.value;
 *    }
 *  }
 *
 * Then the type of our ValueHandler will look like this.
 *
 *  type MyValueHandler = IValueHandler<MyValueWrapper, [return type]>;
 *
 * Or we could do this:
 *
 *  class MyValueHandler implements IValueHandler<MyValueWrapper, boolean> {
 *    /** return true if all values are of type IOrExpression * /
 *    handle(wrapper: MyValueWrapper): boolean {
 *      let value = wrapper.getValue();
 *      if (IOrExpression.is(value)) {
 *        // Due to TypeScript type guard magic, we can access IOrExpression-specific members.
 *        return this.handle(this.getLhs()) && this.handle(this.getRhs());
 *      }
 *      else return false;
 *    }
 *  }
 */

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
