import filters = require("../filters");
import qsBuilder = require("../../sparql/configuration/querystringbuilder"); /* @smell, @todo */
import filterPatterns = require("../filterpatterns");
import schema = require("../../odata/schema");
import mappings = require("../mappings");

export class PropertyTranslatorFactory {

  constructor(private filterPatternStrategy: filterPatterns.FilterGraphPatternStrategy) {}

  public doesApplyToRaw(raw) {
    return raw.type === "member-expression";
  }

  public fromRaw(raw, args: filters.IExpressionTranslatorArgs): filters.IExpressionTranslator {
    let propertyPath = new PropertyPath(raw.path, args.filterContext);
    switch (raw.operation) {
      case "property-value":
        return new PropertyValueTranslator(propertyPath, args);
      case "any":
        return new AnyExpression(raw, propertyPath, args, this.filterPatternStrategy);
      default:
        throw new Error("invalid operation: " + raw.operation);
    }
  }
}

export class PropertyValueTranslator implements filters.IExpressionTranslator {
  private filterContext: filters.IFilterContext;
  private factory: filters.IExpressionTranslatorFactory;
  private propertyPath: PropertyPath;

  constructor(propertyPath: PropertyPath, args: filters.IExpressionTranslatorArgs) {
    this.propertyPath = propertyPath;
    this.filterContext = args.filterContext;
    this.factory = args.factory;
  }

  public getSubExpressions(): filters.IExpressionTranslator[] {
    return [];
  }

  public getPropertyTree(): filters.ScopedPropertyTree {
    return this.getPropertyPathSegmentRelevantForPropertyTree()
      .toScopedPropertyTree();
  }

  public toSparqlFilterClause(): string {
    return this.propertyPath.getFinalElementaryPropertyVariable();
  }

  private getPropertyPathSegmentRelevantForPropertyTree() {
    return this.propertyPath.getPropertyPathWithoutFinalSegments(0);
  }
}

export class AnyExpression implements filters.IExpressionTranslator {
  private raw: any;
  private filterContext: filters.IFilterContext;
  private innerScopeId = new mappings.UniqueScopeIdentifier("any");
  private factory: filters.IExpressionTranslatorFactory;
  private propertyPath: PropertyPath;

  constructor(raw: any, propertyPath: PropertyPath, args: filters.IExpressionTranslatorArgs,
              private filterPatternStrategy: filterPatterns.FilterGraphPatternStrategy) {
    this.raw = raw;
    this.filterContext = args.filterContext;
    this.factory = args.factory;
    this.propertyPath = propertyPath;
  }

  public getSubExpressions(): filters.IExpressionTranslator[] {
    return [];
  }

  public getPropertyTree(): filters.ScopedPropertyTree {
    return this.getPropertyPathSegmentRelevantForPropertyTree()
      .toScopedPropertyTree();
  }

  public toSparqlFilterClause(): string {
    /* @smell inner filter context is created twice: here and in filterpatterns.ts */
    let innerFilterExpression = this.factory.fromRaw(this.raw.lambdaExpression.predicateExpression,
      this.createFilterContextInsideLambda());

    return `EXISTS ${this.buildFilterPatternString(innerFilterExpression)}`;
  }

  private buildFilterPatternString(innerFilterExpression: filters.IExpressionTranslator) {
    let filterPattern = this.filterPatternStrategy.createAnyExpressionPattern(this.filterContext,
      innerFilterExpression.getPropertyTree(), this.createLambdaExpression(), this.propertyPath);
    let queryStringBuilder = new qsBuilder.GraphPatternStringBuilder();
    return queryStringBuilder.buildGraphPatternStringAmendFilterExpression(filterPattern, innerFilterExpression);
  }

  private createFilterContextInsideLambda(): filters.IFilterContext {
    let lambdaExpression = this.createLambdaExpression();
    return {
      mapping: {
        mapping: this.filterContext.mapping.mapping,
        scopedMapping: this.filterContext.mapping.scopedMapping.scope(this.innerScopeId),
      },
      scope: {
        entityType: this.filterContext.scope.entityType,
        unscopedEntityType: this.filterContext.scope.unscopedEntityType,
        lambdaVariableScope: this.filterContext.scope.lambdaVariableScope.clone().add(lambdaExpression),
      },
    };
  }

  private createLambdaExpression(): filters.ILambdaExpression {
    return {
      variable: this.raw.lambdaExpression.variable,
      entityType: this.propertyPath.getFinalEntityType(),
      scopeId: this.innerScopeId,
    };
  }

  private getPropertyPathSegmentRelevantForPropertyTree() {
    // don't include the collection property in the property tree
    return this.propertyPath.getPropertyPathWithoutFinalSegments(1);
  }
}

export class PropertyPath {

  constructor(private propertyNames?: string[], private filterContext?: filters.IFilterContext) {}

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

  public getFilterContextAfterLambdaPrefix(): filters.IFilterContext {
    return {
      scope: {
        entityType: this.getEntityTypeAfterLambdaPrefix(),
        unscopedEntityType: this.filterContext.scope.unscopedEntityType,
        lambdaVariableScope: new filters.LambdaVariableScope(),
      },
      mapping: {
        mapping: this.getMappingAfterLambdaPrefix(),
        scopedMapping: this.filterContext.mapping.scopedMapping,
      },
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
      return this.filterContext.mapping.scopedMapping.getNamespace(this.propertyNames[0]).variables;
    }
    else {
      return this.filterContext.mapping.mapping.variables;
    }
  }

  public getPropertyMappingAfterLambdaPrefix() {
    if (this.pathStartsWithLambdaPrefix()) {
      let type = this.getEntityTypeAfterLambdaPrefix();
      return this.filterContext.mapping.mapping.properties.createMappingFromEntityType(type);
    }
    else {
      return this.filterContext.mapping.mapping.properties;
    }
  }

  public getEntityTypeAfterLambdaPrefix() {
    if (this.pathStartsWithLambdaPrefix()) {
      return this.getPrefixLambdaExpression().entityType;
    }
    else {
      return this.filterContext.scope.entityType;
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
    return this.filterContext.scope.lambdaVariableScope;
  }
}
