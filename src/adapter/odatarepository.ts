import base = require("../odata/repository");
import { EntityType, Property } from "../odata/schema";
import { LambdaVariableScope } from "../odata/filters/filters";
import { IValue } from "../odata/filters/expressions";
import {
  IQueryModel as IODataQueryModel, IQueryContext as IODataQueryContext, JsonResultBuilder,
} from "../odata/queries";

import sparqlProvider = require("../sparql/sparql_provider_base");
import gpatterns = require("../sparql/graphpatterns");
import { ISelectQueryStringBuilder } from "../sparql/querystringbuilder";

import postQueries = require("../adapter/postquery");
import translators = require("../adapter/filtertranslators");
import filterPatterns = require("../adapter/filterpatterns");
import expandTreePatterns = require("../adapter/expandtree");
import mappings = require("../adapter/mappings");

import results = require("../result");

export class ODataRepository<TExpressionVisitor>
  implements base.IRepository<TExpressionVisitor> {

  constructor(private sparqlProvider: sparqlProvider.ISparqlProvider,
              private getQueryStringBuilder: IGetQueryStringBuilder<TExpressionVisitor>,
              private postQueryStringBuilder: postQueries.IQueryStringBuilder) {}

  public getEntities(entityType: EntityType, expandTree: any, filterExpression: IValue<TExpressionVisitor>,
                     cb: (result: results.Result<any[], any>) => void) {
    let model: IQueryAdapterModel<TExpressionVisitor> = new QueryAdapterModel({
      entitySetType: entityType,
      filterOption: filterExpression,
      expandTree: expandTree || {},
    }); /* @todo injectable */
    this.sparqlProvider.querySelect(this.getQueryStringBuilder.fromQueryAdapterModel(model), result => {
      cb(this.translateResponseToOData(result, model));
    });
  }

  public insertEntity(entity: any, type: EntityType, cb: (result: results.AnyResult) => void) {
    this.sparqlProvider.query(this.postQueryStringBuilder.build(entity, type), result => {
      cb(result.process(res => "ok", err => ({ message: "sparql error", error: err })));
    });
  }

  public setSparqlProvider(value: sparqlProvider.ISparqlProvider) {
    this.sparqlProvider = value;
  }

  public setPostQueryStringBuilder(value: postQueries.IQueryStringBuilder) {
    this.postQueryStringBuilder = value;
  }

  private translateResponseToOData(response: results.AnyResult,
                                   model: IQueryAdapterModel<TExpressionVisitor>): results.AnyResult {
    if (response.success()) {
      return results.Result.success(this.translateSuccessfulResponseToOData(response.result(), model));
    }
    else {
      return results.Result.error(response.error());
    }
  }

  private translateSuccessfulResponseToOData(response: any, model: IQueryAdapterModel<TExpressionVisitor>) {
    let queryContext = new SparqlQueryContext(model.getMapping().variables,
      model.getEntitySetType(), model.getExpandTree());
    let resultBuilder = new JsonResultBuilder();
    return resultBuilder.run(response, queryContext);
  }
}

export interface IGetQueryStringBuilder<TExpressionVisitor> {
  fromQueryAdapterModel(model: IQueryAdapterModel<TExpressionVisitor>);
}

export class GetQueryStringBuilder<TExpressionVisitor> implements IGetQueryStringBuilder<TExpressionVisitor> {

  constructor(private filterExpressionFactory: translators.IExpressionTranslatorFactory<TExpressionVisitor>,
              private filterPatternStrategy: filterPatterns.FilterGraphPatternStrategy,
              private expandTreePatternStrategy: expandTreePatterns.ExpandTreeGraphPatternStrategy,
              private sparqlSelectBuilder: ISelectQueryStringBuilder) {
  }

  public fromQueryAdapterModel(model: IQueryAdapterModel<TExpressionVisitor>) {
    let expandGraphPattern = this.createExpandGraphPattern(model);

    let filterExpression = this.createFilterExpression(model);
    let filterGraphPattern = this.createFilterGraphPattern(model, filterExpression);

    let graphPattern = new gpatterns.TreeGraphPattern(model.getMapping().variables.getVariable());
    graphPattern.newConjunctivePattern(expandGraphPattern);
    graphPattern.newConjunctivePattern(filterGraphPattern);

    let prefixes = [
      { prefix: "rdf", uri: "http://www.w3.org/1999/02/22-rdf-syntax-ns#" },
      { prefix: "disco", uri: "http://disco-network.org/resource/" },
    ];

    return this.sparqlSelectBuilder.fromGraphPatternAndFilterExpression(prefixes, graphPattern, filterExpression);
  }

  private createExpandGraphPattern(model: IQueryAdapterModel<TExpressionVisitor>): gpatterns.TreeGraphPattern {
    return this.expandTreePatternStrategy.create(model.getEntitySetType(),
      model.getExpandTree(), model.getMapping().variables);
  }

  private createFilterGraphPattern(model: IQueryAdapterModel<TExpressionVisitor>,
                                   filterExpression?: translators.IExpressionTranslator): gpatterns.TreeGraphPattern {
    if (filterExpression) {

      let filterGraphPattern = this.filterPatternStrategy.createPattern(model.getFilterContext(),
        filterExpression.getPropertyTree());
      return filterGraphPattern;
    }
  }

  private createFilterExpression(model: IQueryAdapterModel<TExpressionVisitor>): translators.IExpressionTranslator {
    if (model.getFilterExpression() !== null) {
      return this.filterExpressionFactory.create(model.getFilterExpression(), model.getFilterContext());
    }
  }
}

export interface IQueryAdapterModel<TVisitor> {
  getFilterContext(): translators.IFilterContext;
  getMapping(): mappings.Mapping;
  getEntitySetType(): EntityType;
  getExpandTree(): any;
  getFilterExpression(): IValue<TVisitor>;
}

export class QueryAdapterModel<TExpressionVisitor> implements IQueryAdapterModel<TExpressionVisitor> {

  private mapping: mappings.Mapping;
  private filterContext: translators.IFilterContext;

  constructor(private odata: IODataQueryModel<TExpressionVisitor>) {}

  public getFilterContext(): translators.IFilterContext {
    if (this.filterContext === undefined) {
      this.filterContext = {
        scope: {
          entityType: this.getEntitySetType(),
          lambdaVariableScope: new LambdaVariableScope(),
        },
        mapping: {
          scope: new mappings.ScopedMapping(this.getMapping()),
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

  public getEntitySetType(): EntityType {
    return this.odata.entitySetType;
  }

  public getExpandTree() {
    return this.odata.expandTree;
  }

  public getFilterExpression() {
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
export class SparqlQueryContext implements IODataQueryContext {
  private mapping: mappings.IStructuredSparqlVariableMapping;
  private rootTypeSchema: EntityType;
  private remainingExpandBranch: Object;

  constructor(mapping: mappings.IStructuredSparqlVariableMapping, rootTypeSchema: EntityType,
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

  public forEachPropertyOfResult(result, fn: (value, property: Property,
          hasValue: boolean) => void): void {
    this.forEachElementaryPropertyOfResult(result, fn);
    this.forEachComplexPropertyOfResult(result, fn);
  }

  public forEachElementaryPropertyOfResult(result, fn: (value, variable: Property,
          hasValue: boolean) => void): void {
    this.rootTypeSchema.getPropertyNames().forEach(propertyName => {
      let property = this.rootTypeSchema.getProperty(propertyName);
      if (property.isNavigationProperty()) return;

      let obj = result[this.mapping.getElementaryPropertyVariable(propertyName).substr(1)];
      let hasValue = obj !== undefined && obj !== null;
      fn(hasValue ? obj.value : undefined, property, hasValue);
    });
  }

  public forEachComplexPropertyOfResult(result, fn: (subResult, property: Property,
          hasValue: boolean) => void): void {
    for (let propertyName of Object.keys(this.remainingExpandBranch)) {
      let propertyIdVar = this.mapping.getComplexProperty(propertyName).getElementaryPropertyVariable("Id");
      let hasValue = result[propertyIdVar.substr(1)] !== undefined;
      fn(result, this.rootTypeSchema.getProperty(propertyName), hasValue);
    }
  }

  public forEachPropertySchema(fn: (property: Property) => void): void {
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

  /** Return another context associated with a complex property. */
  public getSubContext(propertyName: string): SparqlQueryContext {
    /** @todo is it a good idea to create so many instances? */
    return new SparqlQueryContext(
      this.mapping.getComplexProperty(propertyName),
      this.rootTypeSchema.getProperty(propertyName).getEntityType(),
      this.remainingExpandBranch[propertyName]);
  }
}
