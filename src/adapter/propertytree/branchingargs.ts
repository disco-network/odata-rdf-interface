import schema = require("../../odata/schema");
import { ILambdaExpression } from "../../odata/filters";

export type IBranchingArgs = IPropertyBranchingArgs | IInScopeVariableBranchingArgs | IAnyBranchingArgs;

export interface IPropertyBranchingArgs {
  type: "property";
  name: string;
  loose: boolean;
  inverse: boolean;
  complex: boolean;
  mandatory: boolean;
  singleValued: boolean;
  mirroredIdFrom: string;
}

export class PropertyBranchingArgsFactory {
  private modifiers: ((builder: PropertyBranchingArgsBuilder, property: schema.Property) => void)[] = [
    (builder, property) => {
      builder.mirroredIdFrom(property.mirroredFromProperty() && property.mirroredFromProperty().getName());
    },
  ];

  public fromProperty(property: schema.Property): IPropertyBranchingArgs {
    let builder = new PropertyBranchingArgsBuilder()
      .name(property.getName())
      .complex(property.getEntityKind() === schema.EntityKind.Complex)
      .inverse(!property.mirroredFromProperty() && !property.hasDirectRdfRepresentation())
      .mandatory(!property.isOptional())
      .singleValued(property.isCardinalityOne())
      .loose(false);
    for (let modify of this.modifiers) {
      modify(builder, property);
    }
    return builder.value;
  }

  public registerModifier(modify: (builder: PropertyBranchingArgsBuilder, property: schema.Property) => void) {
    this.modifiers.push(modify);
  }
}

export interface IInScopeVariableBranchingArgs {
  type: "inScopeVariable";
  name: string;
  variableType: schema.EntityType;
}

export interface IAnyBranchingArgs {
  type: "any";
  name: string;
  lambdaExpression: ILambdaExpression;
  inverse: boolean;
}

export class BranchingArgsGuard {
  public static isProperty(args: IBranchingArgs): args is IPropertyBranchingArgs {
    return args.type === "property";
  }

  public static isInScopeVariable(args: IBranchingArgs): args is IInScopeVariableBranchingArgs {
    return args.type === "inScopeVariable";
  }

  public static isAny(args: IBranchingArgs): args is IAnyBranchingArgs {
    return args.type === "any";
  }

  public static assertProperty(args: IBranchingArgs): args is IPropertyBranchingArgs {
    if (this.isProperty(args)) return true;
    else throw new Error("PropertyBranchingArgs expected");
  }

  public static assertInScopeVariable(args: IBranchingArgs): args is IInScopeVariableBranchingArgs {
    if (this.isInScopeVariable(args)) return true;
    else throw new Error("InScopeVariableBranchingArgs expected");
  }

  public static assertAny(args: IBranchingArgs): args is IAnyBranchingArgs {
    if (this.isAny(args)) return true;
    else throw new Error("AnyBranchingArgs expected");
  }
}

class PropertyBranchingArgsBuilderTemplate<Value extends { type: "property" }> {
  public value: Value;

  public name(name: string) {
    return this.set({ name: name });
  }

  public complex(value: boolean) {
    return this.set({ complex: value });
  }

  public mandatory(value: boolean) {
    return this.set({ mandatory: value });
  }

  public singleValued(value: boolean) {
    return this.set({ singleValued: value });
  }

  public inverse(value: boolean) {
    return this.set({ inverse: value });
  }

  public loose(value: boolean) {
    return this.set({ loose: value });
  }

  public mirroredIdFrom(value: string) {
    return this.set({ mirroredIdFrom: value });
  }

  private set<T>(value: T): PropertyBranchingArgsBuilderTemplate<Value & T> {
    for (let key of Object.keys(value)) {
      this.value[key] = value[key];
    }
    return this as any as PropertyBranchingArgsBuilderTemplate<Value & T>;
  }
}

export class PropertyBranchingArgsBuilder
  extends PropertyBranchingArgsBuilderTemplate<{ type: "property", mirroredIdFrom: string }> {
  public value = { type: <"property"> "property", mirroredIdFrom: undefined };
}

class InScopeBranchingArgsBuilderTemplate<Value extends { type: "inScopeVariable" }> {
  public value: Value;

  public name(name: string) {
    return this.set({ name: name });
  }

  public variableType(type: schema.EntityType) {
    return this.set({ variableType: type });
  }

  private set<T>(value: T): InScopeBranchingArgsBuilderTemplate<Value & T> {
    for (let key of Object.keys(value)) {
      this.value[key] = value[key];
    }
    return this as any as InScopeBranchingArgsBuilderTemplate<Value & T>;
  }
}

export class InScopeBranchingArgsBuilder extends InScopeBranchingArgsBuilderTemplate<{ type: "inScopeVariable" }> {
  public value = { type: <"inScopeVariable"> "inScopeVariable" };
}

class AnyBranchingArgsBuilderTemplate<Value extends { type: "any" }> {
  public value: Value;

  public name(value: string) {
    this.set({ name: value });
  }

  public lambdaExpression(value: ILambdaExpression) {
    this.set({ lambdaExpression: value });
  }

  public inverse(value: boolean) {
    this.set({ inverse: value });
  }

  private set<T>(value: T): AnyBranchingArgsBuilderTemplate<Value & T> {
    for (let key of Object.keys(value)) {
      this.value[key] = value[key];
    }
    return this as any as AnyBranchingArgsBuilderTemplate<Value & T>;
  }
}

export class AnyBranchingArgsBuilder extends AnyBranchingArgsBuilderTemplate<{ type: "any" }> {
  public value = { type: <"any"> "any" };
}
