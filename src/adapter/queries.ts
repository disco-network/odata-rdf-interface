import mappings = require("./mappings");
import gpatterns = require("../sparql/graphpatterns");
import filterPatterns = require("./filterpatterns");
import expandTreePatterns = require("./expandtree");
import filters = require("./filters");
import qsBuilder = require("./querystring_builder");
import ODataQueries = require("../odata/queries");
import Schema = require("../odata/schema");
import propertyTrees = require("./propertytree");
import propertyTreesImpl = require("./propertytree_impl");
import result = require("../result");

/**
 * Used to generate query objects which can be run to modify and/or retrieve data.
 */
export class QueryFactory {
  constructor(private model: ODataQueries.QueryModel) { }
  public create(): ODataQueries.Query {
    return new EntitySetQuery(this.model, new DependencyInjector());
  }
}

/**
 * Handles read-only OData queries.
 */
export class EntitySetQuery implements ODataQueries.Query {
  private model: QueryModel;
  private filterExpressionFactory: filters.FilterExpressionIoCContainer;

  constructor(odataModel: ODataQueries.QueryModel,
              private dependencyInjector: DependencyInjector) {
    this.model = new QueryModel(odataModel);
  }

  public run(sparqlProvider, cb: (result: result.AnyResult) => void): void {
    sparqlProvider.querySelect(this.generateQueryString(), response => {
      cb(this.translateResponseToOData(response));
    });
  }

  private generateQueryString(): string {
    let expandGraphPattern = this.createExpandGraphPattern();

    let filterExpression = this.createFilterExpression();
    let filterGraphPattern = this.createFilterGraphPattern(filterExpression);

    let queryStringBuilder = this.createQueryStringBuilder();
    return queryStringBuilder.fromGraphPattern(expandGraphPattern, {
      filterExpression: filterExpression,
      filterPattern: filterGraphPattern,
    });
  }

  private translateResponseToOData(response: result.AnyResult): result.AnyResult {
    if (response.success()) {
      return result.Result.success(this.translateSuccessfulResponseToOData(response.result()));
    }
    else {
      return result.Result.error(response.error());
    }
  }

  private translateSuccessfulResponseToOData(response: any) {
    let queryContext = new SparqlQueryContext(this.model.getMapping().variables,
      this.model.getEntitySetType(), this.model.getExpandTree());
    let resultBuilder = new ODataQueries.JsonResultBuilder();
    return resultBuilder.run(response, queryContext);
  }

  private createExpandGraphPattern(): gpatterns.TreeGraphPattern {
    let expandPatternStrategy = this.dependencyInjector.createExpandPatternStrategy();
    return expandPatternStrategy.create(this.model.getEntitySetType(),
      this.model.getExpandTree(), this.model.getMapping().variables);
  }

  private createFilterGraphPattern(filterExpression?: filters.FilterExpression): gpatterns.TreeGraphPattern {
    if (filterExpression) {

      let creationStrategy = this.dependencyInjector.createFilterPatternStrategy();
      let filterGraphPattern = creationStrategy.createPattern(this.model.getFilterContext(),
        filterExpression.getPropertyTree());
      return filterGraphPattern;
    }
  }

  private createFilterExpression(): filters.FilterExpression {
    if (this.model.getRawFilter() !== undefined)
      return this.getFilterExpressionFactory().fromRaw(this.model.getRawFilter());
  }

  private getFilterExpressionFactory() {
    if (this.filterExpressionFactory === undefined) {
      this.filterExpressionFactory = this.dependencyInjector.createFilterExpressionFactory()
        .setStandardFilterContext(this.model.getFilterContext());
    }
    return this.filterExpressionFactory;
  }

  private createQueryStringBuilder(): qsBuilder.QueryStringBuilder {
    let queryStringBuilder = new qsBuilder.QueryStringBuilder();
    queryStringBuilder.insertPrefix("rdf", "http://www.w3.org/1999/02/22-rdf-syntax-ns#");
    queryStringBuilder.insertPrefix(/** @smell */ "disco", "http://disco-network.org/resource/");
    return queryStringBuilder;
  }
}

export class QueryModel {

  private mapping: mappings.Mapping;
  private filterContext: filters.FilterContext;

  constructor(private model: ODataQueries.QueryModel) {}

  public getFilterContext(): filters.FilterContext {
    if (this.filterContext === undefined) {
      this.filterContext = {
        mapping: this.getMapping(),
        entityType: this.getEntitySetType(),
        scopedMapping: new mappings.ScopedMapping(this.getMapping()),
        unscopedEntityType: this.getEntitySetType(),
        lambdaVariableScope: new filters.LambdaVariableScope(),
      };
    }
    return this.filterContext;
  }

  public getMapping(): mappings.Mapping {
    if (this.mapping === undefined) {
      this.initializeVariableMapping();
    }
    return this.mapping;
  }

  public getEntitySetType(): Schema.EntityType {
    return this.model.entitySetType;
  }

  public getExpandTree() {
    return this.model.expandTree;
  }

  public getRawFilter() {
    return this.model.filterOption;
  }

  private initializeVariableMapping() {
    let vargen = new mappings.SparqlVariableGenerator();
    let varMapping = new mappings.StructuredSparqlVariableMapping(vargen.next(), vargen);
    let propMapping = new mappings.PropertyMapping(this.getEntitySetType());
    this.mapping = new mappings.Mapping(propMapping, varMapping);
  }
}

export class DependencyInjector {

  public createFilterExpressionFactory(): filters.FilterExpressionIoCContainer {
    return new filters.FilterExpressionIoCContainer()
      .registerFilterExpressions([
        filters.EqExpressionFactory, filters.AndExpressionFactory, filters.OrExpressionFactory,
        filters.StringLiteralExpressionFactory, filters.NumberLiteralExpressionFactory,
        filters.ParenthesesExpressionFactory,
        new filters.PropertyExpressionFactory(this.createFilterPatternStrategy()),
      ]);
  }

  public createFilterPatternStrategy(): filterPatterns.FilterGraphPatternStrategy {
    return new filterPatterns.FilterGraphPatternStrategy(this.createBranchFactoryForFilering());
  }

  public createQueryStringBuilder(): qsBuilder.QueryStringBuilder {
    return new qsBuilder.QueryStringBuilder();
  }

  public createExpandPatternStrategy(): expandTreePatterns.ExpandTreeGraphPatternFactory {
    return new expandTreePatterns.ExpandTreeGraphPatternFactory(this.createBranchFactoryForExpanding());
  }

  private createBranchFactoryForFilering(): propertyTrees.BranchFactory {
    return new propertyTrees.TreeDependencyInjector()
      .registerFactoryCandidates(
        new propertyTreesImpl.ComplexBranchFactoryForFiltering(),
        new propertyTreesImpl.ElementaryBranchFactoryForFiltering(),
        new propertyTreesImpl.InScopeVariableBranchFactory(),
        new propertyTreesImpl.AnyBranchFactory()
      );
  }

  private createBranchFactoryForExpanding(): propertyTrees.BranchFactory {
    return new propertyTrees.TreeDependencyInjector()
      .registerFactoryCandidates(
        new propertyTreesImpl.ElementarySingleValuedBranchFactory(),
        new propertyTreesImpl.ElementarySingleValuedMirroredBranchFactory(),
        new propertyTreesImpl.ComplexBranchFactory()
      );
  }
}

/**
 * This class provides methods to interpret a SPARQL query result as OData.
 */
export class SparqlQueryContext implements ODataQueries.QueryContext {
  private mapping: mappings.IStructuredSparqlVariableMapping;
  private rootTypeSchema: Schema.EntityType;
  private remainingExpandBranch: Object;

  constructor(mapping: mappings.IStructuredSparqlVariableMapping, rootTypeSchema: Schema.EntityType,
              remainingExpandBranch) {
    this.mapping = mapping;
    this.rootTypeSchema = rootTypeSchema;
    this.remainingExpandBranch = remainingExpandBranch;
  }

  public getUniqueIdOfResult(result): string {
    let variableName = this.mapping.getElementaryPropertyVariable("Id");
    let obj = result && result[variableName.substr(1)];
    if (obj) return obj.value;
  }

  public forEachPropertyOfResult(result, fn: (value, property: Schema.Property,
          hasValue: boolean) => void): void {
    this.forEachElementaryPropertyOfResult(result, fn);
    this.forEachComplexPropertyOfResult(result, fn);
  }

  public forEachElementaryPropertyOfResult(result, fn: (value, variable: Schema.Property,
          hasValue: boolean) => void): void {
    this.rootTypeSchema.getPropertyNames().forEach(propertyName => {
      let property = this.rootTypeSchema.getProperty(propertyName);
      if (property.isNavigationProperty()) return;

      let obj = result[this.mapping.getElementaryPropertyVariable(propertyName).substr(1)];
      let hasValue = obj !== undefined && obj !== null;
      fn(hasValue ? obj.value : undefined, property, hasValue);
    });
  }

  public forEachComplexPropertyOfResult(result, fn: (subResult, property: Schema.Property,
          hasValue: boolean) => void): void {
    for (let propertyName of Object.keys(this.remainingExpandBranch)) {
      let propertyIdVar = this.mapping.getComplexProperty(propertyName).getElementaryPropertyVariable("Id");
      let hasValue = result[propertyIdVar.substr(1)] !== undefined;
      fn(result, this.rootTypeSchema.getProperty(propertyName), hasValue);
    }
  }

  public forEachPropertySchema(fn: (property: Schema.Property) => void): void {
    this.forEachElementaryPropertySchema(fn);
    this.forEachComplexPropertySchema(fn);
  }

  public forEachElementaryPropertySchema(fn: (property) => void): void {
    this.rootTypeSchema.getPropertyNames().forEach(propertyName => {
      let property = this.rootTypeSchema.getProperty(propertyName);
      if (!property.isNavigationProperty()) fn(property);
    });
  }

  public forEachComplexPropertySchema(fn: (property) => void): void {
    for (let propertyName of Object.keys(this.remainingExpandBranch)) {
      fn(this.rootTypeSchema.getProperty(propertyName));
    }
  }

  public getElementaryPropertyOfResult(result, propertyName: string): any {
    return result[this.mapping.getElementaryPropertyVariable(propertyName).substr(1)].value;
  }

  /** Return another context associated with a complex property. */
  public getSubContext(propertyName: string): SparqlQueryContext {
    /** @todo is it a good idea to create so many instances? */
    return new SparqlQueryContext(
      this.mapping.getComplexProperty(propertyName),
      this.rootTypeSchema.getProperty(propertyName).getEntityType(),
      this.remainingExpandBranch[propertyName]);
  }
}
