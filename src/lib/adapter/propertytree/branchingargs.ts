import { Property, EntityKind, EntityType } from "../../odata/schema";
import { ILambdaVariable } from "../../odata/filters/filters";

export interface IBranchingArgs {
  type(): string;
  hash(): string;
}

export interface ITypeConditionBranchingArgs extends IBranchingArgs {
  type(): "typeCondition";
  entityType(): EntityType;
}

export interface IPropertyBranchingArgs extends IBranchingArgs {
  type(): "property";
  schema(): Property;
  name(): string;
  inverse(): boolean;
  complex(): boolean;
  mandatory(): boolean;
  singleValued(): boolean;
}

export interface IInScopeVariableBranchingArgs extends IBranchingArgs {
  type(): "inScopeVariable";
  name(): string;
  variableType(): EntityType;
}

export interface IAnyBranchingArgs extends IBranchingArgs {
  type(): "any";
  name(): string;
  lambdaVariable(): ILambdaVariable;
  inverse(): boolean;
}

export class TypeConditionBranchingArgs implements ITypeConditionBranchingArgs {

  constructor(private expectedType: EntityType) {
  }

  public type(): "typeCondition" { return "typeCondition"; }

  public hash() {
    return JSON.stringify({ type: this.type(), entityType: this.entityType().getName() });
  }

  public entityType() {
    return this.expectedType;
  }
}

export class PropertyBranchingArgs implements IPropertyBranchingArgs {

  constructor(private property: Property) {
  }

  public hash() {
    return JSON.stringify({ type: this.type(), name: this.name() });
  }

  public type(): "property" { return "property"; }

  public schema(): Property {
    return this.property;
  }

  public name() {
    return this.property.getName();
  }

  public inverse() {
    return this.property.hasDirectRdfRepresentation() === false;
  }

  public complex() {
    return this.property.getEntityKind() === EntityKind.Complex;
  }

  public mandatory() {
    return this.property.isOptional() === false;
  }

  public singleValued() {
    return this.property.isMultiplicityOne() === true;
  }
}

export class InScopeVariableBranchingArgs implements IInScopeVariableBranchingArgs {

  constructor(private nameArg: string, private variableTypeArg: EntityType) {}

  public hash() {
    return JSON.stringify({ type: this.type(), name: this.name() });
  }
  public type(): "inScopeVariable" { return "inScopeVariable"; }

  public name() {
    return this.nameArg;
  }

  public variableType() {
    return this.variableTypeArg;
  }
}

export class AnyBranchingArgs implements IAnyBranchingArgs {
  public constructor(private nameArg: string, private lambdaVariableArg: ILambdaVariable,
                     private inverseArg: boolean) {}

  public hash() {
    return JSON.stringify({ type: this.type(), name: this.name(), scope: this.lambdaVariableArg.scopeId.idNumber });
  }

  public type(): "any" { return "any"; }

  public name() {
    return this.nameArg;
  }

  public lambdaVariable() {
    return this.lambdaVariableArg;
  }

  public inverse() {
    return this.inverseArg;
  }
}

export class PropertyBranchingArgsFactory {

  public fromProperty(property: Property): IPropertyBranchingArgs {
    return new PropertyBranchingArgs(property);
  }
}

export class BranchingArgsGuard {

  public static isTypeCondition(args: IBranchingArgs): args is ITypeConditionBranchingArgs {
    return args.type() === "typeCondition";
  }

  public static isProperty(args: IBranchingArgs): args is IPropertyBranchingArgs {
    return args.type() === "property";
  }

  public static isInScopeVariable(args: IBranchingArgs): args is IInScopeVariableBranchingArgs {
    return args.type() === "inScopeVariable";
  }

  public static isAny(args: IBranchingArgs): args is IAnyBranchingArgs {
    return args.type() === "any";
  }

  public static assertTypeCondition(args: IBranchingArgs) {
    if (this.isTypeCondition(args)) return args;
    else throw new Error("TypeConditionBranchingArgs expected");
  }

  public static assertProperty(args: IBranchingArgs) {
    if (this.isProperty(args)) return args;
    else throw new Error("PropertyBranchingArgs expected");
  }

  public static assertInScopeVariable(args: IBranchingArgs) {
    if (this.isInScopeVariable(args)) return args;
    else throw new Error("InScopeVariableBranchingArgs expected");
  }

  public static assertAny(args: IBranchingArgs) {
    if (this.isAny(args)) return args;
    else throw new Error("AnyBranchingArgs expected");
  }
}
