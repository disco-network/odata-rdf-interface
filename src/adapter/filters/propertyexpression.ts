import filters = require("../filters");
import qsBuilder = require("../querystring_builder");
import filterPatterns = require("../filterpatterns");
import schema = require("../../odata/schema");
import mappings = require("../mappings");
import propertyTree = require("../propertytree");
import propertyTreeImpl = require("../propertytree_impl");

export class PropertyExpressionFactory {

  public static doesApplyToRaw(raw) {
    return raw.type === "member-expression";
  }

  public static fromRaw(raw, args: filters.FilterExpressionArgs): filters.FilterExpression {
    let propertyPath = new PropertyPath(raw.path, args.filterContext);
    switch (raw.operation) {
      case "property-value":
        return new PropertyValueExpression(propertyPath, args);
      case "any":
        return new AnyExpression(raw, propertyPath, args);
      default:
        throw new Error("invalid operation: " + raw.operation);
    }
  }
}

export class PropertyValueExpression implements filters.FilterExpression {
  private filterContext: filters.FilterContext;
  private factory: filters.FilterExpressionFactory;
  private propertyPath: PropertyPath;

  constructor(propertyPath: PropertyPath, args: filters.FilterExpressionArgs) {
    this.propertyPath = propertyPath;
    this.filterContext = args.filterContext;
    this.factory = args.factory;
  }

  public getSubExpressions(): filters.FilterExpression[] {
    return [];
  }

  public getPropertyTree(): filters.ScopedPropertyTree {
    return this.getPropertyPathSegmentRelevantForPropertyTree()
      .toScopedPropertyTree();
  }

  public toSparql(): string {
    return this.propertyPath.getFinalElementaryPropertyVariable();
  }

  private getPropertyPathSegmentRelevantForPropertyTree() {
    return this.propertyPath.getPropertyPathWithoutFinalSegments(0);
  }
}

export class AnyExpression {
  private raw: any;
  private filterContext: filters.FilterContext;
  private factory: filters.FilterExpressionFactory;
  private propertyPath: PropertyPath;

  constructor(raw: any, propertyPath: PropertyPath, args: filters.FilterExpressionArgs) {
    this.raw = raw;
    this.filterContext = args.filterContext;
    this.factory = args.factory;
    this.propertyPath = propertyPath;
  }

  public getSubExpressions(): filters.FilterExpression[] {
    return [];
  }

  public getPropertyTree(): filters.ScopedPropertyTree {
    return this.getPropertyPathSegmentRelevantForPropertyTree()
      .toScopedPropertyTree();
  }

  public toSparql(): string {
    /* @smell inner filter context is created twice: here and in filterpatterns.ts */
    let innerFilterExpression = this.factory.fromRaw(this.raw.lambdaExpression.predicateExpression,
      this.createFilterContextInsideLambda());

    return "EXISTS { "
      + this.buildFilterPatternContentString(innerFilterExpression)
      + this.buildFilterExpressionAmendmentString(innerFilterExpression)
      + " }";
  }

  private buildFilterPatternContentString(innerFilterExpression: filters.FilterExpression) {
    /* @smell this should be passed to PropertyExpression */
    let branchFactory = new propertyTree.TreeDependencyInjector()
      .registerFactoryCandidates(
        new propertyTreeImpl.ComplexBranchFactoryForFiltering(),
        new propertyTreeImpl.ElementaryBranchFactoryForFiltering(),
        new propertyTreeImpl.InScopeVariableBranchFactory()
      );
    let filterPatternFactory = new filterPatterns.FilterGraphPatternFactory();
    let filterPattern = filterPatternFactory.createAnyExpressionPattern(this.filterContext,
      innerFilterExpression.getPropertyTree(), this.createLambdaExpression(), this.propertyPath, branchFactory);
    let queryStringBuilder = new qsBuilder.QueryStringBuilder();
    return queryStringBuilder.buildGraphPatternContentString(filterPattern);
  }

  private buildFilterExpressionAmendmentString(innerFilterExpression: filters.FilterExpression) {
    return " . FILTER(" + innerFilterExpression.toSparql() + ")";
  }

  private createFilterContextInsideLambda(): filters.FilterContext {
    let lambdaExpression = this.createLambdaExpression();
    return {
      mapping: this.filterContext.mapping,
      scopedMapping: this.filterContext.scopedMapping,
      entityType: this.filterContext.entityType,
      unscopedEntityType: this.filterContext.unscopedEntityType,
      lambdaVariableScope: this.filterContext.lambdaVariableScope.clone().add(lambdaExpression),
    };
  }

  private createLambdaExpression(): filters.LambdaExpression {
    return {
      variable: this.raw.lambdaExpression.variable,
      entityType: this.propertyPath.getFinalEntityType(),
    };
  }

  private getPropertyPathSegmentRelevantForPropertyTree() {
    // don't include the collection property in the property tree
    return this.propertyPath.getPropertyPathWithoutFinalSegments(1);
  }
}

export class PropertyPath {

  constructor(private propertyNames?: string[], private filterContext?: filters.FilterContext) {}

  public getFinalElementaryPropertyVariable() {
    let mapping = this.getVariableMappingAfterLambdaPrefix();
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

  public getFinalMapping(): mappings.Mapping {
    let currentVariableMapping = this.getVariableMappingAfterLambdaPrefix();
    let propertiesWithoutLambdaPrefix = this.getPropertyNamesWithoutLambdaPrefix();
    for (let i = 0; i < propertiesWithoutLambdaPrefix.length; ++i) {
      currentVariableMapping = currentVariableMapping.getComplexProperty(propertiesWithoutLambdaPrefix[i]);
    }
    return new mappings.Mapping(
      new mappings.PropertyMapping(this.getFinalEntityType()),
      currentVariableMapping
    );
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
      unscopedEntityType: this.filterContext.unscopedEntityType,
      mapping: this.getMappingAfterLambdaPrefix(),
      scopedMapping: this.filterContext.scopedMapping,
      lambdaVariableScope: new filters.LambdaVariableScope(),
    };
  }

  public getMappingAfterLambdaPrefix() {
    return new mappings.Mapping(
      this.getPropertyMappingAfterLambdaPrefix(),
      this.getVariableMappingAfterLambdaPrefix()
    );
  }

  public getVariableMappingAfterLambdaPrefix() {
    if (this.pathStartsWithLambdaPrefix()) {
      return this.filterContext.mapping.variables.getLambdaNamespace(this.propertyNames[0]);
    }
    else {
      return this.filterContext.mapping.variables;
    }
  }

  public getPropertyMappingAfterLambdaPrefix() {
    if (this.pathStartsWithLambdaPrefix()) {
      let type = this.getEntityTypeAfterLambdaPrefix();
      return this.filterContext.mapping.properties.createMappingFromEntityType(type);
    }
    else {
      return this.filterContext.mapping.properties;
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
    return this.propertyNames[0] && this.getLambdaVariableScope().get(this.propertyNames[0]);
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
