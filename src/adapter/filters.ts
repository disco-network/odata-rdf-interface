import mappings = require("./mappings");
import schema = require("../odata/schema");
import propertyExpr = require("./filters/propertyexpression");

export interface IExpressionTranslator {
  getPropertyTree(): ScopedPropertyTree;
  toSparqlFilterClause(): string;
}

export interface IExpressionTranslatorArgs {
  factory: IExpressionTranslatorFactory;
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

export interface IExpressionTranslatorFactory {
  fromRaw(raw, context?: IFilterContext): IExpressionTranslator;
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
 * Selects the appropriate FilterExpression implementation from raw data.
 */
export class FilterToTranslatorChainOfResponsibility {
  private registeredFilterExpressions: ITranslatorFromRawHandler[] = [];

  public pushHandlers(types: ITranslatorFromRawHandler[]) {
    for (let i = 0; i < types.length; ++i) {
      this.pushHandler(types[i]);
    }
    return this;
  }

  public pushHandler(Type: ITranslatorFromRawHandler) {
    if (this.registeredFilterExpressions.indexOf(Type) === -1)
      this.registeredFilterExpressions.push(Type);
    return this;
  }

  /**
   * Create a FilterExpression with the specified FilterContext.
   * The FilterContext will be also used as default value for child expressions -
   * see this.creationArgs(...).
   */
  public fromRaw(raw: any, filterContext): IExpressionTranslator {
    if (this.validateFilterContext(filterContext)) {
      return this.fromRawNoValidations(raw, filterContext);
    }
    else {
      throw new Error("Can't create filter expressions with invalid filter context.");
    }
  }

  public createFactoryWithFilterContext(filterContext: IFilterContext): IExpressionTranslatorFactory {
    return {
      fromRaw: (raw, context = filterContext) => this.fromRaw(raw, context),
    };
  }

  private fromRawNoValidations(raw, filterContext: IFilterContext): IExpressionTranslator {
      for (let i = 0; i < this.registeredFilterExpressions.length; ++i) {
        let SelectedFilterExpression = this.registeredFilterExpressions[i];
        if (SelectedFilterExpression.doesApplyToRaw(raw))
          return SelectedFilterExpression.fromRaw(raw, this.createCreationArgs(filterContext));
      }
      throw new Error("filter expression is not supported: " + JSON.stringify(raw));
  }

  private createCreationArgs(filterContext: IFilterContext): IExpressionTranslatorArgs {
    return {
      factory: this.createFactoryWithFilterContext(filterContext),
      filterContext: filterContext,
    };
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

export interface ITranslatorFromRawHandler {
  fromRaw(raw, args: IExpressionTranslatorArgs): IExpressionTranslator;
  doesApplyToRaw(raw): boolean;
}

export let PropertyTranslatorFactory = propertyExpr.PropertyTranslatorFactory;

export class LiteralTranslatorFactory<ValueType> implements ITranslatorFromRawHandler {
  constructor(private config: ILiteralExpressionConfig<ValueType>) {}

  public fromRaw(raw, args: IExpressionTranslatorArgs): IExpressionTranslator {
    return new LiteralTranslator(this.config.parse(raw), this.config);
  }

  public doesApplyToRaw(raw) {
    return raw.type === this.config.typeName;
  }
}

export let StringLiteralTranslatorFactory = new LiteralTranslatorFactory<string>({
  typeName: "string",
  parse: raw => raw.value,
  toSparql: value => "'" + value + "'",
});

export let NumericLiteralTranslatorFactory = new LiteralTranslatorFactory<number>({
  typeName: "decimalValue",
  parse: raw => {
    let ret = parseInt(raw.value, 10);
    if (isNaN(ret)) throw new Error("error parsing number literal " + raw.value);
    else return ret;
  },
  toSparql: value => "'" + value + "'",
});

export class BinaryOperatorTranslatorFactory implements ITranslatorFromRawHandler {

  constructor(private config: IBinaryOperatorExpressionConfig) {}

  public doesApplyToRaw(raw) {
    return raw.type === "operator" && raw.op === this.config.opName;
  }

  public fromRaw(raw, args: IExpressionTranslatorArgs) {
    return new BinaryOperatorTranslator(raw, this.config, args.factory);
  }
}

export let OrTranslatorFactory = new BinaryOperatorTranslatorFactory({ opName: "or", sparql: "||" });

export let AndTranslatorFactory = new BinaryOperatorTranslatorFactory({ opName: "and", sparql: "&&" });

export let EqTranslatorFactory = new BinaryOperatorTranslatorFactory({ opName: "eq", sparql: "=" });

export class ParenthesesTranslatorFactory {

  public static doesApplyToRaw(raw) {
    return raw.type === "parentheses-expression";
  }

  public static fromRaw(raw, args: IExpressionTranslatorArgs) {
    // We don't have to return a ParenthesesExpression, let's choose the direct way
    return args.factory.fromRaw(raw.inner);
  }
}

export interface ILiteralExpressionConfig<ValueType> {
  typeName: string;
  parse: (raw) => ValueType;
  toSparql: (value: ValueType) => string;
};

export class LiteralTranslator<ValueType> implements IExpressionTranslator {

    private value: ValueType;

    constructor(value: ValueType, private config: ILiteralExpressionConfig<ValueType>) {
      this.value = value;
    }

    public getPropertyTree(): ScopedPropertyTree {
      return ScopedPropertyTree.create();
    }

    public toSparqlFilterClause(): string {
      return this.config.toSparql(this.value);
    }
}

export interface IBinaryOperatorExpressionConfig {
  opName: string;
  sparql: string;
}

export class BinaryOperatorTranslator implements IExpressionTranslator {

    private lhs: IExpressionTranslator;
    private rhs: IExpressionTranslator;

    constructor(raw, private config: IBinaryOperatorExpressionConfig,
                expressionFactory: IExpressionTranslatorFactory) {
      this.lhs = expressionFactory.fromRaw(raw.lhs);
      this.rhs = expressionFactory.fromRaw(raw.rhs);
    }

    public getPropertyTree(): ScopedPropertyTree {
      return FilterExpressionHelper.getPropertyTree([ this.lhs, this.rhs ]);
    }

    public toSparqlFilterClause(): string {
      return `(${this.lhs.toSparqlFilterClause()} ${this.config.sparql} ${this.rhs.toSparqlFilterClause()})`;
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
  public static getPropertyTree(subExpressions: IExpressionTranslator[]): ScopedPropertyTree {
    let propertyTrees = subExpressions.map(se => se.getPropertyTree());
    let result = ScopedPropertyTree.create();
    propertyTrees.forEach(tree => {
      result.merge(tree);
    });
    return result;
  }
}
