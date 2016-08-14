import { EntityType } from "./schema";

export interface IScope {
  entityType: EntityType;
  lambdaVariableScope: LambdaVariableScope;
}

export interface ILambdaVariable {
  name: string;
  entityType: EntityType;
  scopeId: UniqueScopeIdentifier;
}

export class UniqueScopeIdentifier {
  constructor(public debugString: string) {}
  public toString() {
    return "UniqueScopeIdentifier(" + this.debugString + ")";
  }
}

export class LambdaVariableScope {
  private data: { [id: string]: ILambdaVariable } = {};

  public add(lambdaExpression: ILambdaVariable) {
    if (this.exists(lambdaExpression.name) === false) {
      this.data[lambdaExpression.name] = lambdaExpression;
      return this;
    }
    else throw new Error("Variable " + lambdaExpression.name + " was assigned twice");
  }

  public exists(variable: string): boolean {
    return this.data[variable] !== undefined;
  }

  public get(variable: string): ILambdaVariable {
    return this.data[variable];
  }

  public clone(): LambdaVariableScope {
    let cloned = new LambdaVariableScope();
    for (let key of Object.keys(this.data)) {
      cloned.add(this.get(key));
    }
    return cloned;
  }
}
