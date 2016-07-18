import mappings = require("./mappings");
import schema = require("../odata/schema");
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
  entityType?: schema.EntityType;
  mapping?: mappings.StructuredSparqlVariableMapping;
}

export class FilterExpressionFactory {
  private registeredFilterExpressions: FilterExpressionStaticMembers[] = [];
  private creationArgs: FilterExpressionArgs;

  constructor() {
    this.creationArgs = {
      factory: this,
      entityType: undefined,
      mapping: undefined,
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

  public setSparqlVariableMapping(mapping: mappings.StructuredSparqlVariableMapping) {
    this.creationArgs.mapping = mapping;
    return this;
  }

  public setEntityType(entityType: schema.EntityType) {
    this.creationArgs.entityType = entityType;
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
    return this.creationArgs.entityType !== undefined &&
      this.creationArgs.mapping !== undefined &&
      this.creationArgs.factory !== undefined;
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
    ret.mapping = args.mapping;
    ret.entityType = args.entityType;
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
    for (let i = 0; i < this.properties.length; ++i) {
      branch = branch[this.properties[i]] = branch[this.properties[i]] || {};
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
    /* @construction let rawLambdaExpression = this.raw.lambdaExpression;
    let lambdaExpression: filterPatterns.LambdaExpression = {
      variable: rawLambdaExpression.variable,
      expression: this.factory.fromRaw(rawLambdaExpression.predicateExpression),
    };
    let filterContext: filterPatterns.FilterContext = {
      mapping: this.mapping,
      entityType: this.entityType,
      lambdaExpressions: {},
    };
    filterContext.lambdaExpressions[lambdaExpression.variable] = lambdaExpression;
    let filterPattern = filterPatterns.FilterGraphPatternFactory.create(
      filterContext, lambdaExpression.expression.getPropertyTree()
    );
    let queryStringBuilder = ;
    return "EXISTS { ?root disco:prop ?child . FilterPattern[root=?child] . FILTER() }";*/
    return "nope";
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
