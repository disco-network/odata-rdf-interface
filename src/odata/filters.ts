import { EntityType } from "./schema";

export interface IScope {
  entityType: EntityType;
  lambdaVariableScope: LambdaVariableScope;
}

export interface ILambdaExpression {
  variable: string;
  entityType: EntityType;
  scopeId: UniqueScopeIdentifier; /* @construction right place? */
}

export class UniqueScopeIdentifier {
  constructor(public debugString: string) {}
  public toString() {
    return "UniqueScopeIdentifier(" + this.debugString + ")";
  }
}

export class LambdaVariableScope {
  private data: { [id: string]: ILambdaExpression } = {};

  public add(lambdaExpression: ILambdaExpression) {
    if (this.exists(lambdaExpression.variable) === false) {
      this.data[lambdaExpression.variable] = lambdaExpression;
      return this;
    }
    else throw new Error("Variable " + lambdaExpression.variable + " was assigned twice");
  }

  public exists(variable: string): boolean {
    return this.data[variable] !== undefined;
  }

  public get(variable: string): ILambdaExpression {
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
