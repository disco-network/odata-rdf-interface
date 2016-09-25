import { LambdaVariableScope, ILambdaVariable } from "../../odata/filters/filters";
import { ScopedPropertyTree } from "../../odata/filters/propertytree";
import filterTranslators = require("../filtertranslators");
import qsBuilder = require("../../bootstrap/sparql/querystringbuilder"); /* @smell, @todo */
import filterPatterns = require("../filterpatterns");
import schema = require("../../odata/schema");
import { ForeignKeyPropertyResolver } from "../../odata/foreignkeyproperties";
import mappings = require("../mappings");

export class PropertyValueTranslator implements filterTranslators.IExpressionTranslator {
  private filterContext: filterTranslators.IFilterContext;
  private propertyPath: PropertyPath;

  constructor(propertyPath: PropertyPath, filterContext: filterTranslators.IFilterContext) {
    this.propertyPath = propertyPath;
    this.filterContext = filterContext;
  }

  public getPropertyTree(): ScopedPropertyTree {
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

export interface IAnyExpressionTranslatorFactory {
  create(propertyPath: string[],
         lambdaVar: ILambdaVariable, lambdaExpression: filterTranslators.IExpressionTranslator,
         filterContext: filterTranslators.IFilterContext): filterTranslators.IExpressionTranslator;
}

export class AnyExpressionTranslator implements filterTranslators.IExpressionTranslator {

  private propertyPath: PropertyPath;

  constructor(propertyPath: string[], private lambdaVariable: ILambdaVariable,
              private lambdaExpression: filterTranslators.IExpressionTranslator,
              private filterContext: filterTranslators.IFilterContext,
              private filterPatternStrategy: filterPatterns.FilterGraphPatternStrategy) {
    this.propertyPath = new PropertyPath(propertyPath, filterContext);
  }

  public getPropertyTree(): ScopedPropertyTree {
    return this.getPropertyPathSegmentRelevantForPropertyTree()
      .toScopedPropertyTree();
  }

  public toSparqlFilterClause(): string {

    return `EXISTS ${this.buildFilterPatternString(this.lambdaExpression)}`;
  }

  private buildFilterPatternString(innerFilterExpression: filterTranslators.IExpressionTranslator) {
    let filterPattern = this.filterPatternStrategy.createAnyExpressionPattern(this.filterContext,
      innerFilterExpression.getPropertyTree(), this.lambdaVariable, this.propertyPath);
    let queryStringBuilder = new qsBuilder.GraphPatternStringBuilder();
    return queryStringBuilder.buildGraphPatternStringAmendFilterExpression(filterPattern, innerFilterExpression);
  }

  private getPropertyPathSegmentRelevantForPropertyTree() {
    // don't include the collection property in the property tree
    return this.propertyPath.getPropertyPathWithoutFinalSegments(1);
  }
}

export class PropertyPath {

  constructor(private propertyNames: string[], private filterContext: filterTranslators.IFilterContext) {}

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
    if (property.getEntityKind() === schema.EntityKind.Elementary) {
      return mapping.getElementaryPropertyVariable(property.getName());
    }
    else
      throw new Error("The last property has to be elementary.");
  }

  public getPropertyPathWithoutFinalSegments(howMany: number) {
    if (howMany === 0) return this;
    else if (howMany > 0) return new PropertyPath(this.propertyNames.slice(0, -howMany), this.filterContext);
    else throw new Error("howMany has to be >= 0");
  }

  public toScopedPropertyTree() {
    let tree = ScopedPropertyTree.create();
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
    const resolver = new ForeignKeyPropertyResolver();
    const namesWithoutLambdaPrefix = this.pathStartsWithLambdaPrefix() ?
      this.propertyNames.slice(1) : this.propertyNames;
    const transformedPath: schema.Property[] = [];

    let entityType = this.getEntityTypeAfterLambdaPrefix();
    for (const segment of namesWithoutLambdaPrefix) {
      let property = entityType.getProperty(segment);
      entityType = property.getEntityType();
      transformedPath.push.apply(transformedPath, resolver.resolveGetter(property));
    }
    return transformedPath.map(p => p.getName());
  }

  public getFilterContextAfterLambdaPrefix(): filterTranslators.IFilterContext {
    return {
      scope: {
        entityType: this.getEntityTypeAfterLambdaPrefix(),
        lambdaVariableScope: new LambdaVariableScope(),
      },
      mapping: {
        scope: this.filterContext.mapping.scope,
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
      return this.filterContext.mapping.scope.getNamespace(this.propertyNames[0]).variables;
    }
    else {
      return this.filterContext.mapping.scope.unscoped().variables;
    }
  }

  public getPropertyMappingAfterLambdaPrefix() {
    if (this.pathStartsWithLambdaPrefix()) {
      let type = this.getEntityTypeAfterLambdaPrefix();
      return this.filterContext.mapping.scope.unscoped().properties.createMappingFromEntityType(type);
    }
    else {
      return this.filterContext.mapping.scope.unscoped().properties;
    }
  }

  public getEntityTypeAfterLambdaPrefix() {
    const prefix = this.getPrefixLambdaVariable();
    if (prefix !== undefined) {
      return prefix.entityType;
    }
    else {
      return this.filterContext.scope.entityType;
    }
  }

  public pathStartsWithLambdaPrefix() {
    return this.getPrefixLambdaVariable() !== undefined;
  }

  public getPrefixLambdaVariable() {
    const firstPropertyName = this.propertyNames[0];
    if (firstPropertyName !== undefined)
      return this.getLambdaVariableScope().get(firstPropertyName);
  }

  private createAndReturnPropertyTreeBranchOfLambdaPrefix(tree: ScopedPropertyTree) {
    const prefix = this.getPrefixLambdaVariable();
    if (prefix !== undefined) {
      let inScopeVar = prefix.name;
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
