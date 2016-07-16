import mappings = require("./sparql_mappings");

export interface FilterExpression {
  getSubExpressions(): FilterExpression[];
  getPropertyTree(): PropertyTree;
  toSparql(): string;
}

export interface FilterExpressionClass {
  create(raw, mapping: mappings.StructuredSparqlVariableMapping, factory: FilterExpressionFactory): FilterExpression;
  doesApplyToRaw(raw): boolean;
}

export class FilterExpressionFactory {
  private registeredFilterExpressions: FilterExpressionClass[] = [];
  private mapping: mappings.StructuredSparqlVariableMapping;

  public fromRaw(raw: any): FilterExpression {
    for (let i = 0; i < this.registeredFilterExpressions.length; ++i) {
      let SelectedFilterExpression = this.registeredFilterExpressions[i];
      if (SelectedFilterExpression.doesApplyToRaw(raw)) return SelectedFilterExpression.create(raw, this.mapping, this);
    }
    throw new Error("filter expression is not supported: " + JSON.stringify(raw));
  }

  public setSparqlVariableMapping(mapping: mappings.StructuredSparqlVariableMapping) {
    this.mapping = mapping;
    return this;
  }

  public registerDefaultFilterExpressions() {
    this.registerFilterExpressions([
      StringLiteralExpression, NumberLiteralExpression,
      ParenthesesExpressionFactory,
      EqExpression,
      PropertyExpression,
    ]);
    return this;
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

export class StringLiteralExpression implements FilterExpression {

  public static doesApplyToRaw(raw): boolean {
    return raw.type === "string";
  }

  public static create(raw, mapping: mappings.StructuredSparqlVariableMapping,
                       factory: FilterExpressionFactory): StringLiteralExpression {
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

export class NumberLiteralExpression implements FilterExpression {

  public static doesApplyToRaw(raw): boolean {
    return raw.type === "decimalValue";
  }

  public static create(raw, mapping: mappings.StructuredSparqlVariableMapping,
                       factory: FilterExpressionFactory): NumberLiteralExpression {
    let ret = new NumberLiteralExpression();
    ret.value = parseInt(raw.value, 10);
    if (isNaN(ret.value)) throw new Error("error parsing number " + raw.value);
    return ret;
  }

  // ===

  public value: number;

  public getSubExpressions(): FilterExpression[] {
    return [];
  }

  public getPropertyTree(): PropertyTree {
    return {};
  }

  public toSparql(): string {
    return this.value.toString();
  }
}

export class EqExpression implements FilterExpression {

  public static doesApplyToRaw(raw): boolean {
    return raw.type === "operator" && raw.op === "eq";
  }

  public static create(raw, mapping: mappings.StructuredSparqlVariableMapping,
                       factory: FilterExpressionFactory): EqExpression {
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
    return "(" + this.lhs.toSparql() + " = " + this.rhs.toSparql() + ")";
  }
}

export class PropertyExpression implements FilterExpression {

  public static doesApplyToRaw(raw) {
    return raw.type === "member-expression";
  }

  public static create(raw, mapping: mappings.StructuredSparqlVariableMapping,
                       factory: FilterExpressionFactory): PropertyExpression {
    let ret = new PropertyExpression();
    ret.propertyName = raw.path.propertyName;
    ret.mapping = mapping;
    return ret;
  }

  // ===

  private propertyName: string;
  private mapping: mappings.StructuredSparqlVariableMapping;

  public getSubExpressions(): FilterExpression[] {
    return [];
  }

  public getPropertyTree(): PropertyTree {
    let tree: PropertyTree = {};
    tree[this.propertyName] = {};
    return tree;
  }

  public toSparql(): string {
    return this.mapping.getElementaryPropertyVariable(this.propertyName);
  }
}

export class ParenthesesExpressionFactory {

  public static doesApplyToRaw(raw) {
    return raw.type === "parentheses-expression";
  }

  public static create(raw, mapping: mappings.StructuredSparqlVariableMapping, factory: FilterExpressionFactory) {
    // We don't have to return a ParenthesesExpression, let's choose the simpler way
    return factory.fromRaw(raw.inner);
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
