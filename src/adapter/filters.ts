import mappings = require("./mappings");
import schema = require("../odata/schema");
import qsBuilder = require("./querystring_builder");
import filterPatterns = require("./filterpatterns");

export interface FilterExpression {
  getSubExpressions(): FilterExpression[];
  getPropertyTree(): PropertyTree;
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
  lambdaExpressions: { [id: string]: LambdaExpression };
}

export interface LambdaExpression {
  variable: string;
  expression?: FilterExpression;
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
      filterContext.lambdaExpressions !== undefined;
  }

  private validateFactory(factory: FilterExpressionFactory) {
    return factory !== undefined;
  }
}

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

/* @smell create two classes: PropertyValueExpression and AnyExpression */
export class PropertyExpression implements FilterExpression {

  public static doesApplyToRaw(raw) {
    return raw.type === "member-expression";
  }

  public static create(raw, args: FilterExpressionArgs): PropertyExpression {
    let ret = new PropertyExpression();
    ret.raw = raw;
    ret.factory = args.factory;
    ret.properties = raw.path;
    ret.operation = this.operationFromRaw(raw.operation);
    ret.mapping = args.filterContext.mapping;
    ret.entityType = args.filterContext.entityType;
    return ret;
  }

  private static operationFromRaw(raw: string) {
    switch (raw) {
      case "property-value":
        return PropertyExpressionOperation.PropertyValue;
      case "any":
        return PropertyExpressionOperation.Any;
      default:
        throw new Error("invalid operation string: " + raw);
    }
  }

  // ===

  private raw: any;
  private factory: FilterExpressionFactory;
  private properties: string[];
  private operation: PropertyExpressionOperation;
  private mapping: mappings.StructuredSparqlVariableMapping;
  private entityType: schema.EntityType;

  public getSubExpressions(): FilterExpression[] {
    return [];
  }

  public getPropertyTree(): PropertyTree {
    let tree: PropertyTree = {};
    let branch = tree;
    let propertiesToInclude: string[];
    switch (this.operation) {
      case PropertyExpressionOperation.PropertyValue:
        propertiesToInclude = this.properties;
        break;
      case PropertyExpressionOperation.Any:
        propertiesToInclude = this.properties.slice(0, -1);
        break;
      default:
        throw new Error("this.operation has an invalid value");
    }
    for (let i = 0; i < propertiesToInclude.length; ++i) {
      let property = propertiesToInclude[i];
      branch = branch[property] = branch[property] || {};
    }
    return tree;
  }

  public toSparql(): string {
    switch (this.operation) {
      case PropertyExpressionOperation.PropertyValue:
        return this.propertyValueExpressionToSparql();
      case PropertyExpressionOperation.Any:
        return this.anyExpressionToSparql();
      default:
        throw new Error("Huh? this.operation has an invalid value");
    }
  }

  private propertyValueExpressionToSparql(): string {
    let currentMapping = this.mapping;
    for (let i = 0; i < (this.properties.length - 1); ++i) {
        currentMapping = currentMapping.getComplexProperty(this.properties[i]);
    }
    return currentMapping.getElementaryPropertyVariable(this.properties[this.properties.length - 1]);
  }

  private anyExpressionToSparql(): string {
    let rawLambdaExpression = this.raw.lambdaExpression;
    let lambdaExpression: LambdaExpression = {
      variable: rawLambdaExpression.variable,
      /* @todo expression should be processed in the newly created lambda environment */
      expression: this.factory.fromRaw(rawLambdaExpression.predicateExpression),
      entityType: this.getEntityTypeOfPropertyPath(),
    };
    let filterContext: FilterContext = {
      mapping: this.mapping,
      entityType: this.entityType,
      lambdaExpressions: {},
    };
    filterContext.lambdaExpressions[lambdaExpression.variable] = lambdaExpression;

    let filterPattern = filterPatterns.FilterGraphPatternFactory.createAnyExpressionPattern(
      filterContext, lambdaExpression.expression.getPropertyTree(), lambdaExpression, this.properties
    );
    let queryStringBuilder = new qsBuilder.QueryStringBuilder();
    let patternContentString = queryStringBuilder.buildGraphPatternContentString(filterPattern);
    let filterString = " . FILTER(" + lambdaExpression.expression.toSparql() + ")";
    return "EXISTS { " + patternContentString + filterString + " }";
  }

  private getEntityTypeOfPropertyPath(): schema.EntityType {
    let currentType = this.entityType;
    for (let i = 0; i < this.properties.length; ++i) {
      currentType = currentType.getProperty(this.properties[i]).getEntityType();
    }
    return currentType;
  }
}

export enum PropertyExpressionOperation {
  PropertyValue, Any
}

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

    public getPropertyTree(): PropertyTree {
      return {};
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

    public getPropertyTree(): PropertyTree {
      return FilterExpressionHelper.getPropertyTree(this.getSubExpressions());
    }

    public toSparql(): string {
      return "(" + this.lhs.toSparql() + " " + config.sparql + " " + this.rhs.toSparql() + ")";
    }
  };
  return GeneratedClass;
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
