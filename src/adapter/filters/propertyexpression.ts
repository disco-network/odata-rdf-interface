import filters = require("../filters");
import qsBuilder = require("../querystring_builder");
import filterPatterns = require("../filterpatterns");
import schema = require("../../odata/schema");

/* @smell create two classes: PropertyValueExpression and AnyExpression */
export class PropertyExpression implements filters.FilterExpression {

  public static doesApplyToRaw(raw) {
    return raw.type === "member-expression";
  }

  public static create(raw, args: filters.FilterExpressionArgs): PropertyExpression {
    let ret = new PropertyExpression();
    ret.raw = raw;
    ret.filterContext = args.filterContext;
    ret.factory = args.factory;
    ret.propertyPath = new PropertyPath(raw.path, args.filterContext);
    ret.operation = this.operationFromRaw(raw.operation);
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
  private filterContext: filters.FilterContext;
  private factory: filters.FilterExpressionFactory;
  private propertyPath: PropertyPath;
  private operation: PropertyExpressionOperation;

  public getSubExpressions(): filters.FilterExpression[] {
    return [];
  }

  public getPropertyTree(): filters.ScopedPropertyTree {
    return this.getPropertyPathSegmentRelevantForPropertyTree()
      .toScopedPropertyTree();
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

  private getPropertyPathSegmentRelevantForPropertyTree() {

    switch (this.operation) {

      case PropertyExpressionOperation.PropertyValue:
        return this.propertyPath.getPropertyPathWithoutFinalSegments(0);

      case PropertyExpressionOperation.Any:
        // don't include the collection property in the property tree
        return this.propertyPath.getPropertyPathWithoutFinalSegments(1);

      default:
        throw new Error("this.operation has an invalid value");
    }
  }

  private propertyValueExpressionToSparql(): string {
    return this.propertyPath.getFinalElementaryPropertyVariable();
  }

  private anyExpressionToSparql(): string {
    let lambdaExpressionFilterContext = {
      mapping: this.filterContext.mapping,
      entityType: this.filterContext.entityType,
      lambdaVariableScope: filters.cloneLambdaVariableScope(this.filterContext.lambdaVariableScope),
    };
    let lambdaExpressionFactory = this.factory.clone();
    lambdaExpressionFactory.setFilterContext(lambdaExpressionFilterContext);
    let rawLambdaExpression = this.raw.lambdaExpression;
    let lambdaExpression: filters.LambdaExpression = {
      variable: rawLambdaExpression.variable,
      entityType: this.propertyPath.getFinalEntityType(),
    };
    lambdaExpressionFilterContext.lambdaVariableScope[lambdaExpression.variable] = lambdaExpression;
    let lambdaFilterExpression = lambdaExpressionFactory.fromRaw(rawLambdaExpression.predicateExpression);

    let filterPattern = filterPatterns.FilterGraphPatternFactory.createAnyExpressionPattern(
      this.filterContext, lambdaFilterExpression.getPropertyTree(), lambdaExpression,
        this.propertyPath
    );
    let queryStringBuilder = new qsBuilder.QueryStringBuilder();
    let patternContentString = queryStringBuilder.buildGraphPatternContentString(filterPattern);
    let filterString = " . FILTER(" + lambdaFilterExpression.toSparql() + ")";
    return "EXISTS { " + patternContentString + filterString + " }";
  }
}

export class PropertyPath {

  constructor(private propertyNames?: string[], private filterContext?: filters.FilterContext) {}

  public getFinalElementaryPropertyVariable() {
    let mapping = this.getMappingAfterLambdaPrefix();
    let entityType = this.getEntityTypeAfterLambdaPrefix();

    let properties = this.getPropertyNamesWithoutLambdaPrefix();
    for (let i = 0; i < (properties.length - 1); ++i) {
      let property = entityType.getProperty(properties[i]);
      entityType = property.getEntityType();
      if (property.getEntityKind() === schema.EntityKind.Complex) {
        mapping = mapping.getComplexProperty(property.getName());
      }
      else {
        throw new Error("All intermediate properties have to be complex.");
      }
    }

    let property = entityType.getProperty(properties[properties.length - 1]);
    if (property.getEntityKind() === schema.EntityKind.Elementary)
      return mapping.getElementaryPropertyVariable(property.getName());
    else
      throw new Error("The last property has to be elementary.");
  }

  public getPropertyPathWithoutFinalSegments(howMany: number) {
    if (howMany === 0) return this;
    else if (howMany > 0) return new PropertyPath(this.propertyNames.slice(0, -howMany), this.filterContext);
    else throw new Error("howMany has to be >= 0");
  }

  public toScopedPropertyTree() {
    let tree = filters.ScopedPropertyTree.create();
    let branch = this.createAndReturnPropertyTreeBranchOfLambdaPrefix(tree);
    let propertiesToInclude = this.getPropertyNamesWithoutLambdaPrefix();
    for (let i = 0; i < propertiesToInclude.length; ++i) {
      let property = propertiesToInclude[i];
      branch = branch.createBranch(property);
    }
    return tree;
  }

  public getFinalEntityType(): schema.EntityType {
    let currentType = this.getEntityTypeAfterLambdaPrefix();
    let propertiesWithoutLambdaPrefix = this.getPropertyNamesWithoutLambdaPrefix();
    for (let i = 0; i < propertiesWithoutLambdaPrefix.length; ++i) {
      currentType = currentType.getProperty(propertiesWithoutLambdaPrefix[i]).getEntityType();
    }
    return currentType;
  }

  public getPropertyNamesWithoutLambdaPrefix() {
    return this.pathStartsWithLambdaPrefix() ?
      this.propertyNames.slice(1) : this.propertyNames;
  }

  public getFilterContextAfterLambdaPrefix(): filters.FilterContext {
    return {
      entityType: this.getEntityTypeAfterLambdaPrefix(),
      mapping: this.getMappingAfterLambdaPrefix(),
      lambdaVariableScope: {},
    };
  }

  public getMappingAfterLambdaPrefix() {
    if (this.pathStartsWithLambdaPrefix()) {
      return this.filterContext.mapping.getLambdaNamespace(this.propertyNames[0]);
    }
    else {
      return this.filterContext.mapping;
    }
  }

  public getEntityTypeAfterLambdaPrefix() {
    if (this.pathStartsWithLambdaPrefix()) {
      return this.getPrefixLambdaExpression().entityType;
    }
    else {
      return this.filterContext.entityType;
    }
  }

  public pathStartsWithLambdaPrefix() {
    return this.getPrefixLambdaExpression() !== undefined;
  }

  public getPrefixLambdaExpression() {
    return this.propertyNames[0] && this.getLambdaVariableScope()[this.propertyNames[0]];
  }

  private createAndReturnPropertyTreeBranchOfLambdaPrefix(tree: filters.ScopedPropertyTree) {
    if (this.pathStartsWithLambdaPrefix()) {
      let inScopeVar = this.getPrefixLambdaExpression().variable;
      return tree.inScopeVariables.createBranch(inScopeVar);
    }
    else {
      return tree.root;
    }
  }

  private getLambdaVariableScope() {
    return this.filterContext.lambdaVariableScope;
  }
}

export enum PropertyExpressionOperation {
  PropertyValue, Any
}
