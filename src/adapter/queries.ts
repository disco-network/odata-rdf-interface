import mappings = require("./mappings");
import gpatterns = require("../sparql/graphpatterns");
import filterPatterns = require("./filterpatterns");
import expandTreePatterns = require("./expandtree");
import filters = require("./filters");
import qsBuilder = require("./querystring_builder");
import ODataQueries = require("../odata/queries");
import Schema = require("../odata/schema");
import result = require("../result");

/**
 * Used to generate query objects which can be run to modify and/or retrieve data.
 */
/* @todo open/closed principle: use factory candidates (see FilterExpressionIoCContainer)? */
export class QueryFactory {
  constructor(private model: IQueryAdapterModel,
              private createEntitySetQuery: (model: IQueryAdapterModel) => ODataQueries.IQuery) { }
  public create(): ODataQueries.IQuery {
    return this.createEntitySetQuery(this.model);
  }
}

/**
 * Handles read-only OData queries.
 */
export class EntitySetQuery implements ODataQueries.IQuery {

  constructor(private model: IQueryAdapterModel,
              private filterExpressionFactory: filters.FilterExpressionIoCContainer,
              private filterPatternStrategy: filterPatterns.FilterGraphPatternStrategy,
              private expandTreePatternStrategy: expandTreePatterns.ExpandTreeGraphPatternStrategy) {
    this.filterExpressionFactory.setStandardFilterContext(this.model.getFilterContext());
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
    return this.expandTreePatternStrategy.create(this.model.getEntitySetType(),
      this.model.getExpandTree(), this.model.getMapping().variables);
  }

  private createFilterGraphPattern(filterExpression?: filters.IFilterExpression): gpatterns.TreeGraphPattern {
    if (filterExpression) {

      let filterGraphPattern = this.filterPatternStrategy.createPattern(this.model.getFilterContext(),
        filterExpression.getPropertyTree());
      return filterGraphPattern;
    }
  }

  private createFilterExpression(): filters.IFilterExpression {
    if (this.model.getRawFilter() !== undefined)
      return this.getFilterExpressionFactory().fromRaw(this.model.getRawFilter());
  }

  private getFilterExpressionFactory() {
    return this.filterExpressionFactory;
  }

  private createQueryStringBuilder(): qsBuilder.QueryStringBuilder {
    let queryStringBuilder = new qsBuilder.QueryStringBuilder();
    queryStringBuilder.insertPrefix("rdf", "http://www.w3.org/1999/02/22-rdf-syntax-ns#");
    queryStringBuilder.insertPrefix(/** @smell */ "disco", "http://disco-network.org/resource/");
    return queryStringBuilder;
  }
}

export interface IQueryAdapterModel {
  getFilterContext(): filters.IFilterContext;
  getMapping(): mappings.Mapping;
  getEntitySetType(): Schema.EntityType;
  getExpandTree(): any;
  getRawFilter(): any;
}

export class QueryAdapterModel implements IQueryAdapterModel {

  private mapping: mappings.Mapping;
  private filterContext: filters.IFilterContext;

  constructor(private odata: ODataQueries.IQueryModel) {}

  public getFilterContext(): filters.IFilterContext {
    if (this.filterContext === undefined) {
      this.filterContext = {
        scope: {
          entityType: this.getEntitySetType(),
          unscopedEntityType: this.getEntitySetType(),
          lambdaVariableScope: new filters.LambdaVariableScope(),
        },
        mapping: {
          mapping: this.getMapping(),
          scopedMapping: new mappings.ScopedMapping(this.getMapping()),
        },
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
    return this.odata.entitySetType;
  }

  public getExpandTree() {
    return this.odata.expandTree;
  }

  public getRawFilter() {
    return this.odata.filterOption;
  }

  private initializeVariableMapping() {
    let vargen = new mappings.SparqlVariableGenerator();
    let varMapping = new mappings.StructuredSparqlVariableMapping(vargen.next(), vargen);
    let propMapping = new mappings.PropertyMapping(this.getEntitySetType());
    this.mapping = new mappings.Mapping(propMapping, varMapping);
  }
}

/**
 * This class provides methods to interpret a SPARQL query result as OData.
 */
export class SparqlQueryContext implements ODataQueries.IQueryContext {
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
