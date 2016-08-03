import mappings = require("./mappings");
import schema = require("../odata/schema");
import propertyExpr = require("./filters/propertyexpression");

export interface IFilterExpression {
  getSubExpressions(): IFilterExpression[];
  getPropertyTree(): ScopedPropertyTree;
  toSparql(): string;
}

export interface IFilterExpressionArgs {
  factory: IFilterExpressionFactory;
  filterContext?: IFilterContext;
}

export interface IFilterContext {
  scope: IFilterScopeContext;
  mapping: IFilterMappingContext;
}

export interface IFilterScopeContext {
  entityType: schema.EntityType;
  unscopedEntityType: schema.EntityType;
  lambdaVariableScope: LambdaVariableScope;
}

export interface IFilterMappingContext {
  mapping: mappings.Mapping;
  scopedMapping: mappings.ScopedMapping;
}

export interface ILambdaExpression {
  variable: string;
  entityType: schema.EntityType;
  scopeId: mappings.UniqueScopeIdentifier;
}

export interface IFilterExpressionFactory {
  fromRaw(raw, context?: IFilterContext): IFilterExpression;
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

/**
 * Creates appropriate FilterExpressions from raw data.
 */
export class FilterExpressionIoCContainer {
  private registeredFilterExpressions: IFilterExpressionCandidateFactory[] = [];
  private standardFilterContext: IFilterContext;

  public setStandardFilterContext(filterContext: IFilterContext) {
    this.standardFilterContext = filterContext;
    return this;
  }

  public registerFilterExpressions(types: IFilterExpressionCandidateFactory[]) {
    for (let i = 0; i < types.length; ++i) {
      this.registerFilterExpression(types[i]);
    }
    return this;
  }

  public registerFilterExpression(Type: IFilterExpressionCandidateFactory) {
    if (this.registeredFilterExpressions.indexOf(Type) === -1)
      this.registeredFilterExpressions.push(Type);
    return this;
  }

  /**
   * Create a FilterExpression with the specified FilterContext.
   * The FilterContext will be also used as default value for child expressions -
   * see this.creationArgs(...).
   */
  public fromRaw(raw: any, filterContext = this.standardFilterContext): IFilterExpression {
    if (this.validateCreationArgs()) {
      return this.fromRawNoValidations(raw, filterContext);
    }
    else {
      throw new Error("Can't create filter expressions with incomplete creation args.");
    }
  }

  private fromRawNoValidations(raw, filterContext: IFilterContext): IFilterExpression {
      for (let i = 0; i < this.registeredFilterExpressions.length; ++i) {
        let SelectedFilterExpression = this.registeredFilterExpressions[i];
        if (SelectedFilterExpression.doesApplyToRaw(raw))
          return SelectedFilterExpression.fromRaw(raw, this.createCreationArgs(filterContext));
      }
      throw new Error("filter expression is not supported: " + JSON.stringify(raw));
  }

  private createCreationArgs(filterContext: IFilterContext): IFilterExpressionArgs {
    return {
      factory: { fromRaw: (raw, context = filterContext) => this.fromRaw(raw, context) },
      filterContext: filterContext,
    };
  }

  private validateCreationArgs(): boolean {
    return this.validateFilterContext(this.standardFilterContext);
  }

  private validateFilterContext(filterContext: IFilterContext) {
    return filterContext !== undefined &&
      this.validateFilterScopeContext(filterContext.scope) &&
      this.validateFilterMappingContext(filterContext.mapping);
  }

  private validateFilterScopeContext(context: IFilterScopeContext) {
    return context.entityType !== undefined &&
      context.lambdaVariableScope !== undefined &&
      context.unscopedEntityType !== undefined;
  }

  private validateFilterMappingContext(context: IFilterMappingContext) {
    return context.mapping !== undefined && context.scopedMapping !== undefined;
  }
}

export interface IFilterExpressionCandidateFactory {
  fromRaw(raw, args: IFilterExpressionArgs): IFilterExpression;
  doesApplyToRaw(raw): boolean;
}

export let PropertyExpressionFactory = propertyExpr.PropertyExpressionFactory;

export class LiteralExpressionFactory<ValueType> implements IFilterExpressionCandidateFactory {
  constructor(private config: ILiteralExpressionConfig<ValueType>) {}

  public fromRaw(raw, args: IFilterExpressionArgs): IFilterExpression {
    return new LiteralExpression(this.config.parse(raw), this.config);
  }

  public doesApplyToRaw(raw) {
    return raw.type === this.config.typeName;
  }
}

export let StringLiteralExpressionFactory = new LiteralExpressionFactory<string>({
  typeName: "string",
  parse: raw => raw.value,
  toSparql: value => "'" + value + "'",
});

export let NumberLiteralExpressionFactory = new LiteralExpressionFactory<number>({
  typeName: "decimalValue",
  parse: raw => {
    let ret = parseInt(raw.value, 10);
    if (isNaN(ret)) throw new Error("error parsing number literal " + raw.value);
    else return ret;
  },
  toSparql: value => "'" + value + "'",
});

export class BinaryOperatorExpressionFactory implements IFilterExpressionCandidateFactory {

  constructor(private config: IBinaryOperatorExpressionConfig) {}

  public doesApplyToRaw(raw) {
    return raw.type === "operator" && raw.op === this.config.opName;
  }

  public fromRaw(raw, args: IFilterExpressionArgs) {
    return new BinaryOperatorExpression(raw, this.config, args.factory);
  }
}

export let OrExpressionFactory = new BinaryOperatorExpressionFactory({ opName: "or", sparql: "||" });

export let AndExpressionFactory = new BinaryOperatorExpressionFactory({ opName: "and", sparql: "&&" });

export let EqExpressionFactory = new BinaryOperatorExpressionFactory({ opName: "eq", sparql: "=" });

export class ParenthesesExpressionFactory {

  public static doesApplyToRaw(raw) {
    return raw.type === "parentheses-expression";
  }

  public static fromRaw(raw, args: IFilterExpressionArgs) {
    // We don't have to return a ParenthesesExpression, let's choose the direct way
    return args.factory.fromRaw(raw.inner);
  }
}

export interface ILiteralExpressionConfig<ValueType> {
  typeName: string;
  parse: (raw) => ValueType;
  toSparql: (value: ValueType) => string;
};

export class LiteralExpression<ValueType> implements IFilterExpression {

    private value: ValueType;

    constructor(value: ValueType, private config: ILiteralExpressionConfig<ValueType>) {
      this.value = value;
    }

    public getSubExpressions(): IFilterExpression[] {
      return [];
    }

    public getPropertyTree(): ScopedPropertyTree {
      return ScopedPropertyTree.create();
    }

    public toSparql(): string {
      return this.config.toSparql(this.value);
    }
}

export interface IBinaryOperatorExpressionConfig {
  opName: string;
  sparql: string;
}

export class BinaryOperatorExpression {

    private lhs: IFilterExpression;
    private rhs: IFilterExpression;

    constructor(raw, private config: IBinaryOperatorExpressionConfig,
                expressionFactory: IFilterExpressionFactory) {
      this.lhs = expressionFactory.fromRaw(raw.lhs);
      this.rhs = expressionFactory.fromRaw(raw.rhs);
    }

    public getSubExpressions(): IFilterExpression[] {
      return [ this.lhs, this.rhs ];
    }

    public getPropertyTree(): ScopedPropertyTree {
      return FilterExpressionHelper.getPropertyTree(this.getSubExpressions());
    }

    public toSparql(): string {
      return "(" + this.lhs.toSparql() + " " + this.config.sparql + " " + this.rhs.toSparql() + ")";
    }
}

/* @smell decide where to move PropertyPath */
export let PropertyPath = propertyExpr.PropertyPath;
export type PropertyPath = propertyExpr.PropertyPath;

export class ScopedPropertyTree {

  public static fromDataObjects(root: any, inScopeVariables: any = {}) {
    return this.create(FlatPropertyTree.fromDataObject(root), FlatPropertyTree.fromDataObject(inScopeVariables));
  }

  public static create(root = FlatPropertyTree.empty(), inScopeVariables = FlatPropertyTree.empty()) {
    return new ScopedPropertyTree(root, inScopeVariables);
  }

  public root: FlatPropertyTree;
  public inScopeVariables: FlatPropertyTree;

  constructor(root = FlatPropertyTree.empty(), inScopeVariables = FlatPropertyTree.empty()) {
    this.root = root;
    this.inScopeVariables = inScopeVariables;
  }

  public merge(other: ScopedPropertyTree) {
    this.root.merge(other.root);
    this.inScopeVariables.merge(other.inScopeVariables);
  }
}

export class FlatPropertyTree {

  public static empty() {
    return this.fromDataObject({});
  }

  public static fromDataObject(data: IFlatPropertyTreeDataObject) {
    let tree = new FlatPropertyTree();
    tree.data = {};
    for (let property of Object.keys(data)) {
      tree.data[property] = FlatPropertyTree.fromDataObject(data[property]);
    }
    return tree;
  }

  private data: { [id: string]: FlatPropertyTree };

  public createBranch(property: string) {
    return this.data[property] = this.data[property] || FlatPropertyTree.fromDataObject({});
  }

  public getBranch(property: string) {
    if (this.branchExists(property))
      return this.data[property];
    else
      throw new Error("branch " + property + " does not exist");
  }

  public branchExists(property: string) {
    return this.data[property] !== undefined;
  }

  /**
   * Return an iterator object whose current() method returns the first item.
   * Calling next() will make the iterator step forward and return item 2 etc.
   */
  public getIterator(): IIterator<string> {
    let properties = Object.keys(this.data);
    let i = 0;
    return { current: () => properties[i], next: () => properties[++i], hasValue: () => properties.length > i };
  }

  public clone() {
    let cloned = FlatPropertyTree.empty();
    cloned.merge(this);
    return cloned;
  }

  public merge(other: FlatPropertyTree) {
    for (let it = other.getIterator(), property = it.current(); it.hasValue(); it.next()) {
      let branch = this.createBranch(property);
      branch.merge(other.getBranch(property));
    }
  }

  public toDataObject() {
    let ret: IFlatPropertyTreeDataObject = {};
    for (let it = this.getIterator(); it.hasValue(); it.next()) {
      ret[it.current()] = this.getBranch(it.current()).toDataObject();
    }
    return ret;
  }
}

export interface IFlatPropertyTreeDataObject {
  [id: string]: IFlatPropertyTreeDataObject;
}

export interface IIterator<T> {
  current(): T;
  next(): T;
  hasValue(): boolean;
}

export class FilterExpressionHelper {
  public static getPropertyTree(subExpressions: IFilterExpression[]): ScopedPropertyTree {
    let propertyTrees = subExpressions.map(se => se.getPropertyTree());
    let result = ScopedPropertyTree.create();
    propertyTrees.forEach(tree => {
      result.merge(tree);
    });
    return result;
  }
}
