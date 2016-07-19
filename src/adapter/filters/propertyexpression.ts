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
    ret.properties = raw.path;
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
  private properties: string[];
  private operation: PropertyExpressionOperation;

  public getSubExpressions(): filters.FilterExpression[] {
    return [];
  }

  public getPropertyTree(): filters.PropertyTree {
    let tree: filters.PropertyTree = {};
    let branch = tree;
    let propertiesToInclude = this.getPropertyPathSegmentOfCardinalityOne();
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

  private getPropertyPathSegmentOfCardinalityOne() {
    switch (this.operation) {
      case PropertyExpressionOperation.PropertyValue:
        return this.properties;
      case PropertyExpressionOperation.Any:
        return this.properties.slice(0, -1);
      default:
        throw new Error("this.operation has an invalid value");
    }
  }

  private propertyValueExpressionToSparql(): string {
    let currentMapping = this.getMappingAfterLambdaPrefix();
    let propertiesWithoutLambdaPrefix = this.getPathWithoutLambdaPrefix();
    for (let i = 0; i < (propertiesWithoutLambdaPrefix.length - 1); ++i) {
        currentMapping = currentMapping.getComplexProperty(propertiesWithoutLambdaPrefix[i]);
    }
    return currentMapping.getElementaryPropertyVariable(
      propertiesWithoutLambdaPrefix[propertiesWithoutLambdaPrefix.length - 1]);
  }

  private anyExpressionToSparql(): string {
    let lambdaExpressionFilterContext = {
      mapping: this.filterContext.mapping,
      entityType: this.filterContext.entityType,
      lambdaExpressions: this.cloneLambdaExpressionDictionary(this.filterContext.lambdaExpressions),
    };
    let lambdaExpressionFactory = this.factory.clone();
    lambdaExpressionFactory.setFilterContext(lambdaExpressionFilterContext);
    let rawLambdaExpression = this.raw.lambdaExpression;
    let lambdaExpression: filters.LambdaExpression = {
      variable: rawLambdaExpression.variable,
      entityType: this.getEntityTypeOfPropertyPath(),
    };
    lambdaExpressionFilterContext.lambdaExpressions[lambdaExpression.variable] = lambdaExpression;
    let lambdaFilterExpression = lambdaExpressionFactory.fromRaw(rawLambdaExpression.predicateExpression);

    let filterPattern = filterPatterns.FilterGraphPatternFactory.createAnyExpressionPattern(
      lambdaExpressionFilterContext, lambdaFilterExpression.getPropertyTree(), lambdaExpression, this.properties
    );
    let queryStringBuilder = new qsBuilder.QueryStringBuilder();
    let patternContentString = queryStringBuilder.buildGraphPatternContentString(filterPattern);
    let filterString = " . FILTER(" + lambdaFilterExpression.toSparql() + ")";
    return "EXISTS { " + patternContentString + filterString + " }";
  }

  private getEntityTypeOfPropertyPath(): schema.EntityType {
    let currentType = this.getEntityTypeAfterLambdaPrefix();
    let propertiesWithoutLambdaPrefix = this.getPathWithoutLambdaPrefix();
    for (let i = 0; i < propertiesWithoutLambdaPrefix.length; ++i) {
      currentType = currentType.getProperty(propertiesWithoutLambdaPrefix[i]).getEntityType();
    }
    return currentType;
  }

  private pathStartsWithLambdaPrefix() {
    return this.getLambdaExpression() !== undefined;
  }

  private getEntityTypeAfterLambdaPrefix() {
    if (this.pathStartsWithLambdaPrefix()) {
      return this.getLambdaExpression().entityType;
    }
    else {
      return this.filterContext.entityType;
    }
  }

  private getMappingAfterLambdaPrefix() {
    if (this.pathStartsWithLambdaPrefix()) {
      return this.filterContext.mapping.getLambdaNamespace(this.properties[0]);
    }
    else {
      return this.filterContext.mapping;
    }
  }

  private getLambdaExpression() {
    return this.properties[0] && this.filterContext.lambdaExpressions[this.properties[0]];
  }

  private getFilterContextAfterLambdaPrefix(): filters.FilterContext {
    return {
      entityType: this.getEntityTypeAfterLambdaPrefix(),
      mapping: this.getMappingAfterLambdaPrefix(),
      lambdaExpressions: {},
    };
  }

  private getPathWithoutLambdaPrefix() {
    return this.pathStartsWithLambdaPrefix() ?
      this.properties.slice(1) : this.properties;
  }

  private cloneLambdaExpressionDictionary(lambdaExpressions: { [id: string]: filters.LambdaExpression }
                                         ): { [id: string]: filters.LambdaExpression } {
    let result: { [id: string]: filters.LambdaExpression } = {};
    Object.keys(lambdaExpressions).forEach(key => {
      result[key] = lambdaExpressions[key];
    });
    return result;
  }
}

export enum PropertyExpressionOperation {
  PropertyValue, Any
}
