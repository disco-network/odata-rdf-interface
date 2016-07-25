/** @module */
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

/**
 * Used to generate query objects which can be run to modify and/or retrieve data.
 */
export class QueryFactory {
  constructor(private model: ODataQueries.QueryModel, private schema) { }
  public create(): ODataQueries.Query {
    return new EntitySetQuery(this.model, this.schema);
  }
}

/**
 * Handles read-only OData queries.
 */
export class EntitySetQuery implements ODataQueries.Query {
  private mapping: mappings.Mapping;
  private queryString: string;
  private filterExpressionFactory: filters.FilterExpressionIoCContainer;

  constructor(private model: ODataQueries.QueryModel, private schema: Schema.Schema) {
    this.prepareSparqlQuery();
  }

  public run(sparqlProvider, cb: (result: { error?: any, result?: any }) => void): void {
    sparqlProvider.querySelect(this.queryString, response => {
      cb(this.translateResponseToOData(response));
    });
  }

  private prepareSparqlQuery() {
    this.initializeFilterExpressionFactory();
    this.initializeQueryString();
  }

  private translateResponseToOData(response: { error?: any, result?: any }): { error?: any, result?: any } {
    if (!response.error) {
      let queryContext = new SparqlQueryContext(this.getOrInitMapping().variables,
        this.getTypeOfEntitySet(), this.getExpandTree());
      let resultBuilder = new ODataQueries.JsonResultBuilder();
      return { result: resultBuilder.run(response.result, queryContext) };
    }
    else {
      return { error: response.error };
    }
  }

  private getTypeOfEntitySet(): Schema.EntityType {
    let entitySetSchema = this.schema.getEntitySet(this.model.entitySetName);
    return entitySetSchema.getEntityType();
  }

  private initializeVariableMapping() {
    let vargen = new mappings.SparqlVariableGenerator();
    let varMapping = new mappings.StructuredSparqlVariableMapping(vargen.next(), vargen);
    let propMapping = new mappings.PropertyMapping(this.getTypeOfEntitySet());
    this.mapping = new mappings.Mapping(propMapping, varMapping);
  }

  private initializeFilterExpressionFactory() {
    this.filterExpressionFactory = new filters.FilterExpressionIoCContainer()
      .registerDefaultFilterExpressions()
      .setStandardFilterContext(this.createFilterContext());
  }

  private initializeQueryString() {
    let expandGraphPattern = this.createGraphPattern();
    let filterExpression = this.createFilterExpression();
    let filterGraphPattern = this.createFilterGraphPattern(filterExpression);
    let queryStringBuilder = this.createQueryStringBuilder();
    this.queryString = queryStringBuilder.fromGraphPattern(expandGraphPattern, {
      filterExpression: filterExpression,
      filterPattern: filterGraphPattern,
    });
  }

  private createGraphPattern(): gpatterns.TreeGraphPattern {
    let branchFactory = new propertyTrees.TreeDependencyInjector()
      .registerFactoryCandidates(
        new propertyTreesImpl.ElementarySingleValuedBranchFactory(),
        new propertyTreesImpl.ElementarySingleValuedMirroredBranchFactory(),
        new propertyTreesImpl.ComplexBranchFactory()
      );
    return expandTreePatterns.ExpandTreeGraphPatternFactory.create(this.getTypeOfEntitySet(),
      this.getExpandTree(), this.getOrInitMapping().variables, branchFactory);
  }

  private createFilterGraphPattern(filterExpression: filters.FilterExpression): gpatterns.TreeGraphPattern {
    let filterPatternFactory = new filterPatterns.FilterGraphPatternFactory();
    let branchFactory = new propertyTrees.TreeDependencyInjector()
      .registerFactoryCandidates(
        new propertyTreesImpl.ComplexBranchFactoryForFiltering(),
        new propertyTreesImpl.ElementaryBranchFactoryForFiltering(),
        new propertyTreesImpl.InScopeVariableBranchFactory()
      );
    if (filterExpression !== undefined)
      return filterPatternFactory.create(this.createFilterContext(),
        filterExpression.getPropertyTree(), branchFactory);
  }

  private createFilterExpression(): filters.FilterExpression {
    if (this.getRawFilter()) return this.filterExpressionFactory.fromRaw(this.getRawFilter());
  }

  private createQueryStringBuilder(): qsBuilder.QueryStringBuilder {
    let queryStringBuilder = new qsBuilder.QueryStringBuilder();
    queryStringBuilder.insertPrefix("rdf", "http://www.w3.org/1999/02/22-rdf-syntax-ns#");
    queryStringBuilder.insertPrefix("disco", "http://disco-network.org/resource/");
    return queryStringBuilder;
  }

  private createFilterContext(): filters.FilterContext {
    return {
      mapping: this.getOrInitMapping(),
      scopedMapping: new mappings.ScopedMapping(this.getOrInitMapping()),
      entityType: this.getTypeOfEntitySet(),
      unscopedEntityType: this.getTypeOfEntitySet(),
      lambdaVariableScope: new filters.LambdaVariableScope(),
    };
  }

  private getExpandTree() {
    return this.model.expandTree;
  }

  private getRawFilter() {
    return this.model.filterOption;
  }

  private getOrInitMapping() {
    if (this.mapping === undefined) {
      this.initializeVariableMapping();
    }
    return this.mapping;
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
