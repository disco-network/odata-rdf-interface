export interface FilterExpressionClass {
  create(raw, factory: FilterExpressionFactory): FilterExpression;
  doesApplyToRaw(raw): boolean;
}

export class FilterExpressionFactory {
  private registeredFilterExpressions: FilterExpressionClass[] = [];

  public fromRaw(raw: any): FilterExpression {
    for (let i = 0; i < this.registeredFilterExpressions.length; ++i) {
      let SelectedFilterExpression = this.registeredFilterExpressions[i];
      if (SelectedFilterExpression.doesApplyToRaw(raw)) return SelectedFilterExpression.create(raw, this);
    }
  }

  public registerDefaultFilterExpressions() {
    this.registerFilterExpressions([
      StringLiteralExpression, EqExpression,
    ]);
  }

  public registerFilterExpressions(types: FilterExpressionClass[]) {
    for (let i = 0; i < types.length; ++i) {
      this.registerFilterExpression(types[i]);
    }
  }

  public registerFilterExpression(Type: FilterExpressionClass) {
    if (this.registeredFilterExpressions.indexOf(Type) === -1)
      this.registeredFilterExpressions.push(Type);
  }
}

export interface FilterExpression {
  getSubExpressions(): FilterExpression[];
  getPropertyTree(): PropertyTree;
  toSparql(): string;
}

export class StringLiteralExpression implements FilterExpression {

  public static doesApplyToRaw(raw): boolean {
    return raw.type === "string";
  }

  public static create(raw, factory: FilterExpressionFactory): StringLiteralExpression {
    let ret = new StringLiteralExpression();
    ret.value = raw.value;
    return ret;
  }

  // ===

  public value: string;

  public getSubExpressions(): FilterExpression[] {
    return [];
  }

  public getPropertyTree(): PropertyTree {
    return {};
  }

  public toSparql(): string {
    return "'" + this.value + "'";
  }
}

export class EqExpression implements FilterExpression {

  public static doesApplyToRaw(raw): boolean {
    return raw.type === "operator" && raw.op === "eq";
  }

  public static create(raw, factory: FilterExpressionFactory): EqExpression {
    let ret = new EqExpression();
    ret.lhs = factory.fromRaw(raw.lhs);
    ret.rhs = factory.fromRaw(raw.rhs);
    return ret;
  }

  // ===

  public lhs: FilterExpression;
  public rhs: FilterExpression;

  public getSubExpressions(): FilterExpression[] {
    return [ this.lhs, this.rhs ];
  }

  public getPropertyTree(): PropertyTree {
    return FilterExpressionHelper.getPropertyTree(this.getSubExpressions());
  }

  public toSparql(): string {
    return this.lhs.toSparql() + " = " + this.rhs.toSparql();
  }
}

export interface PropertyTree {
  [id: string]: PropertyTree;
}

export class PropertyTreeBuilder {
  public tree: PropertyTree = {};

  public merge(other: PropertyTree) {
    this.mergeRecursive(this.tree, other);
  }

  private mergeRecursive(baseBranch: PropertyTree, mergeBranch: PropertyTree) {
    Object.keys(mergeBranch).forEach(propertyName => {
      if (baseBranch[propertyName] === undefined) {
        baseBranch[propertyName] = {};
      }
      this.mergeRecursive(baseBranch[propertyName], mergeBranch[propertyName]);
    });
  }
}

export class FilterExpressionHelper {
  public static getPropertyTree(subExpressions: FilterExpression[]): PropertyTree {
    let propertyTrees = subExpressions.map(se => se.getPropertyTree());
    let returnTreeBuilder = new PropertyTreeBuilder();
    propertyTrees.forEach(tree => {
      returnTreeBuilder.merge(tree);
    });
    return returnTreeBuilder.tree;
  }
}