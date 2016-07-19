import mappings = require("./mappings");
import schema = require("../odata/schema");
import propertyExpr = require("./filters/propertyexpression");

export interface FilterExpression {
  getSubExpressions(): FilterExpression[];
  getPropertyTree(): ScopedPropertyTree;
  toSparql(): string;
}

export interface FilterExpressionStaticMembers {
  create(raw, args: FilterExpressionArgs): FilterExpression;
  doesApplyToRaw(raw): boolean;
}

export interface FilterExpressionArgs {
  factory: FilterExpressionFactory;
  filterContext?: FilterContext;
}

export interface FilterContext {
  mapping: mappings.StructuredSparqlVariableMapping;
  entityType: schema.EntityType;
  lambdaVariableScope: { [id: string]: LambdaExpression };
}

export function cloneLambdaVariableScope(lambdaExpressions: { [id: string]: LambdaExpression }
                                         ): { [id: string]: LambdaExpression } {
  let result: { [id: string]: LambdaExpression } = {};
  Object.keys(lambdaExpressions).forEach(key => {
    result[key] = lambdaExpressions[key];
  });
  return result;
}

export interface LambdaExpression {
  variable: string;
  entityType: schema.EntityType;
}

export class FilterExpressionFactory {
  private registeredFilterExpressions: FilterExpressionStaticMembers[] = [];
  private creationArgs: FilterExpressionArgs;

  constructor() {
    this.creationArgs = {
      factory: this,
      filterContext: undefined,
    };
  }

  public clone() {
    let cloned = new FilterExpressionFactory()
      .registerFilterExpressions(this.registeredFilterExpressions)
      .setFilterContext(this.creationArgs.filterContext);
    return cloned;
  }

  public fromRaw(raw: any): FilterExpression {
    if (this.validateCreationArgs()) {
      for (let i = 0; i < this.registeredFilterExpressions.length; ++i) {
        let SelectedFilterExpression = this.registeredFilterExpressions[i];
        if (SelectedFilterExpression.doesApplyToRaw(raw))
          return SelectedFilterExpression.create(raw, this.creationArgs);
      }
      throw new Error("filter expression is not supported: " + JSON.stringify(raw));
    }
    else {
      throw new Error("Can't create filter expressions with incomplete creation args.");
    }
  }

  public setFilterContext(filterContext: FilterContext) {
    this.creationArgs.filterContext = filterContext;
    return this;
  }

  public registerDefaultFilterExpressions() {
    this.registerFilterExpressions([
      StringLiteralExpression, NumberLiteralExpression,
      ParenthesesExpressionFactory,
      AndExpression, OrExpression,
      EqExpression,
      PropertyExpression,
    ]);
    return this;
  }

  public registerFilterExpressions(types: FilterExpressionStaticMembers[]) {
    for (let i = 0; i < types.length; ++i) {
      this.registerFilterExpression(types[i]);
    }
    return this;
  }

  public registerFilterExpression(Type: FilterExpressionStaticMembers) {
    if (this.registeredFilterExpressions.indexOf(Type) === -1)
      this.registeredFilterExpressions.push(Type);
    return this;
  }

  private validateCreationArgs(): boolean {
    return this.validateFilterContext(this.creationArgs.filterContext) &&
      this.validateFactory(this.creationArgs.factory);
  }

  private validateFilterContext(filterContext: FilterContext) {
    return filterContext !== undefined &&
      filterContext.entityType !== undefined &&
      filterContext.mapping !== undefined &&
      filterContext.lambdaVariableScope !== undefined;
  }

  private validateFactory(factory: FilterExpressionFactory) {
    return factory !== undefined;
  }
}

export let PropertyExpression = propertyExpr.PropertyExpression;
export type PropertyExpression = propertyExpr.PropertyExpression;
export let PropertyPath = propertyExpr.PropertyPath;
export type PropertyPath = propertyExpr.PropertyPath;

export let StringLiteralExpression = literalExpression<string>({
  typeName: "string",
  parse: raw => raw.value,
  toSparql: value => "'" + value + "'",
});
export type StringLiteralExpression = FilterExpression;

export let NumberLiteralExpression = literalExpression<number>({
  typeName: "decimalValue",
  parse: raw => {
    let ret = parseInt(raw.value, 10);
    if (isNaN(ret)) throw new Error("error parsing number literal " + raw.value);
    else return ret;
  },
  toSparql: value => "'" + value + "'",
});
export type NumberLiteralExpression = FilterExpression;

export let OrExpression = binaryOperator({ opName: "or", sparql: "||" });
export type OrExpression = FilterExpression;

export let AndExpression = binaryOperator({ opName: "and", sparql: "&&" });
export type AndExpression = FilterExpression;

export let EqExpression = binaryOperator({ opName: "eq", sparql: "=" });
export type EqExpression = FilterExpression;

export class ParenthesesExpressionFactory {

  public static doesApplyToRaw(raw) {
    return raw.type === "parentheses-expression";
  }

  public static create(raw, args: FilterExpressionArgs) {
    // We don't have to return a ParenthesesExpression, let's choose the direct way
    return args.factory.fromRaw(raw.inner);
  }
}

function literalExpression<ValueType>(config: {
  typeName: string;
  parse: (raw) => ValueType;
  toSparql: (value: ValueType) => string }
) {

  let GeneratedClass = class {

    public static doesApplyToRaw(raw): boolean {
      return raw.type === config.typeName;
    }

    public static create(raw, args: FilterExpressionArgs) {
      let ret = new GeneratedClass();
      ret.value = config.parse(raw);
      return ret;
    }

    // ===

    private value: ValueType;

    public getSubExpressions(): FilterExpression[] {
      return [];
    }

    public getPropertyTree(): ScopedPropertyTree {
      return new ScopedPropertyTree();
    }

    public toSparql(): string {
      return config.toSparql(this.value);
    }
  };
  return GeneratedClass;
}

function binaryOperator(config: { opName: string; sparql: string }) {

  let GeneratedClass = class {

    public static doesApplyToRaw(raw): boolean {
      return raw.type === "operator" && raw.op === config.opName;
    }

    public static create(raw, args: FilterExpressionArgs) {
      let ret = new GeneratedClass();
      ret.lhs = args.factory.fromRaw(raw.lhs);
      ret.rhs = args.factory.fromRaw(raw.rhs);
      return ret;
    }

    // ===

    private lhs: FilterExpression;
    private rhs: FilterExpression;

    public getSubExpressions(): FilterExpression[] {
      return [ this.lhs, this.rhs ];
    }

    public getPropertyTree(): ScopedPropertyTree {
      return FilterExpressionHelper.getPropertyTree(this.getSubExpressions());
    }

    public toSparql(): string {
      return "(" + this.lhs.toSparql() + " " + config.sparql + " " + this.rhs.toSparql() + ")";
    }
  };
  return GeneratedClass;
}

export class ScopedPropertyTree {
  public root: FlatPropertyTree;
  public inScopeVariables: FlatPropertyTree;

  constructor(root: FlatPropertyTree = {}, inScopeVariables: FlatPropertyTree = {}) {
    this.root = root;
    this.inScopeVariables = inScopeVariables;
  }
}

export interface FlatPropertyTree {
  [id: string]: FlatPropertyTree;
}

export class PropertyTreeBuilder {
  public tree = new ScopedPropertyTree();

  public merge(other: ScopedPropertyTree) {
    this.mergeRecursive(this.tree, other);
  }

  private mergeRecursive(baseBranch: ScopedPropertyTree, mergeBranch: ScopedPropertyTree) {
    Object.keys(mergeBranch).forEach(propertyName => {
      if (baseBranch[propertyName] === undefined) {
        baseBranch[propertyName] = {};
      }
      this.mergeRecursive(baseBranch[propertyName], mergeBranch[propertyName]);
    });
  }
}

export class FilterExpressionHelper {
  public static getPropertyTree(subExpressions: FilterExpression[]): ScopedPropertyTree {
    let propertyTrees = subExpressions.map(se => se.getPropertyTree());
    let returnTreeBuilder = new PropertyTreeBuilder();
    propertyTrees.forEach(tree => {
      returnTreeBuilder.merge(tree);
    });
    return returnTreeBuilder.tree;
  }
}
