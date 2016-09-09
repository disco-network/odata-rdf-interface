import base = require("../odata/repository");
import { EntityType, Property, EntityKind } from "../odata/schema";
import { LambdaVariableScope } from "../odata/filters/filters";
import { IValue } from "../odata/filters/expressions";
import {
  IQueryModel as IODataQueryModel,
} from "../odata/queries";

import sparqlProvider = require("../sparql/sparql_provider_base");
import gpatterns = require("../sparql/graphpatterns");
import { ISelectQueryStringBuilder } from "../sparql/querystringbuilder";

import postQueries = require("../adapter/postquery");
import translators = require("../adapter/filtertranslators");
import filterPatterns = require("../adapter/filterpatterns");
import expandTreePatterns = require("../adapter/expandtree");
import mappings = require("../adapter/mappings");
import { ForeignKeyPropertyResolver } from "../odata/foreignkeyproperties";

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
    let queryContext = new QueryContext(model.getMapping().variables,
      model.getEntitySetType(), model.getExpandTree());
    let resultBuilder = new JsonResultBuilder();
    return resultBuilder.run(response, queryContext);
  }
}

export class JsonResultBuilder {
  public run(results: any[], context: IQueryContext): any[] {
    let entityCollection = new EntityCollection(context, EntityKind.Complex);

    results.forEach(result => {
      entityCollection.applyResult(result);
    });

    return entityCollection.serializeToODataJson();
  }
}

export interface IEntityValue {
  /** Apply the values of variables in this result object. */
  applyResult(result: any): void;
  /** Create a JS data object conforming to the OData output format. */
  serializeToODataJson(): any;
}

export class EntityCollection implements IEntityValue {
  private context: IQueryContext;
  private kind: EntityKind;
  private entities: { [id: string]: IEntityValue } = {};

  constructor(context: IQueryContext, kind: EntityKind) {
    this.context = context;
    this.kind = kind;
  }

  ///
  public applyResult(result: any): void {

    let id = this.context.getUniqueIdOfResult(result);
    if (!Object.prototype.hasOwnProperty.call(this.entities, id)) {

      this.entities[id] = EntityFactory.fromEntityKind(this.kind, this.context);
    }

    this.entities[id].applyResult(result);
  }

  public serializeToODataJson() {
    return Object.keys(this.entities).map(id => this.entities[id].serializeToODataJson());
  }
}

export class ComplexEntity implements IEntityValue {
  private context: IQueryContext;
  private value: { [id: string]: IEntityValue } = undefined;
  private id: any;

  constructor(context: IQueryContext) {
    this.context = context;
  }

  public applyResult(result: any): void {
    let resultId = this.context.getUniqueIdOfResult(result);
    let firstResultOrSameId = this.id === undefined || resultId === this.id;

    if (firstResultOrSameId) {
      if (this.value === undefined) {
        this.initializeWithId(resultId);
      }
      this.context.forEachPropertyOfResult(result, (resultOfProperty, property, hasValueInResult) => {
        this.applyResultToProperty(resultOfProperty, property, hasValueInResult);
      });
    }
    else {
      throw new Error("found different values for a property of quantity one");
    }
  }

  public serializeToODataJson(): any {
    if (this.id === undefined) return null;
    let serialized = {};

    let serializeProperty = property => {
      let propertyName = property.getName();
      let entity = this.getPropertyEntity(property);
      let entityExists = this.hasPropertyEntity(property);
      serialized[propertyName] = entityExists ? entity.serializeToODataJson() : null;
    };

    this.context.forEachPropertySchema(serializeProperty);

    return serialized;
  }

  private initializeWithId(id) {
    this.id = id;
    this.value = {};
  }

  private applyResultToProperty(result: any, property: Property, hasValueInResult: boolean) {
    if (!this.hasPropertyEntity(property)) {
      this.setPropertyEntity(property,
        EntityFactory.fromPropertyWithContext(property, this.context));
    }

    if (hasValueInResult) this.value[property.getName()].applyResult(result);
  }

  private hasPropertyEntity(property: Property) {
    return this.getPropertyEntity(property) !== undefined;
  }

  private getPropertyEntity(property: Property) {
    return this.value[property.getName()];
  }

  private setPropertyEntity(property: Property, value) {
    this.value[property.getName()] = value;
  }
}

export class ElementaryEntity implements IEntityValue {
  private value: any;

  public applyResult(value: any): void {
    if (this.value === undefined) {
      this.value = value;
    }
    else if (this.value !== value) {
      throw new Error("found different values for a property of quantity one");
    }
  }

  public serializeToODataJson(): any {
    return this.value === undefined ? null : this.value;
  }
}

export class EntityFactory {
  public static fromPropertyWithContext(property: Property, context: IQueryContext): IEntityValue {
    let kind = property.getEntityKind();
    let subContext = context.getSubContext(property.getName());
    if (property.isCardinalityOne()) {
      return EntityFactory.fromEntityKind(kind, subContext);
    }
    else {
      return new EntityCollection(subContext, kind);
    }
  }

  public static fromEntityKind(kind: EntityKind, context: IQueryContext): IEntityValue {
    switch (kind) {
      case EntityKind.Elementary:
        return new ElementaryEntity();
      case EntityKind.Complex:
        return new ComplexEntity(context);
      default:
        throw new Error("invalid EntityKind " + kind);
    }
  }
}

export interface IQueryContext {
  /** Iterate over all elementary properties expected by the query and pass their value. */
  forEachElementaryPropertyOfResult(result, fn: (value, property: Property, hasValue: boolean) => void): void;
  /** Iterate over all complex properties expected by the query. */
  forEachComplexPropertyOfResult(result, fn: (subResult, property: Property, hasValue: boolean) => void): void;
  /** Iterate over all properties and pass their value respective subResult. */
  forEachPropertyOfResult(result, fn: (value, property: Property, hasValue: boolean) => void): void;
  getDirectElementaryPropertyOfResult(propertyName: string, result): { value; hasValue: boolean };

  forEachPropertySchema(fn: (property: Property) => void): void;
  forEachElementaryPropertySchema(fn: (property: Property) => void): void;
  forEachComplexPropertySchema(fn: (property: Property) => void): void;

  getUniqueIdOfResult(result): string;
  getSubContext(property: string): IQueryContext;
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

export class QueryContext implements IQueryContext {
  private resolver = new ForeignKeyPropertyResolver();

  constructor(private mapping: mappings.IStructuredSparqlVariableMapping,
              private rootTypeSchema: EntityType,
              private remainingExpandBranch) {
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
      const property = this.rootTypeSchema.getProperty(propertyName);
      if (property.isNavigationProperty()) return;

      const resolved = this.resolver.resolveGetter(property);
      const complexProperties = resolved.slice(0, -1);
      const elementaryProperty = resolved.slice(-1)[0];
      let currentContext: IQueryContext = this;
      for (const segment of complexProperties) {
        currentContext = this.getSubContext(segment.getName());
      }

      let valueContainer = currentContext.getDirectElementaryPropertyOfResult(elementaryProperty.getName(), result);

      fn(valueContainer.hasValue ? valueContainer.value : undefined, property, valueContainer.hasValue);
    });
  }

  public getDirectElementaryPropertyOfResult(propertyName: string, result): { value; hasValue: boolean } {
    const obj = result[this.mapping.getElementaryPropertyVariable(propertyName).substr(1)];
    const hasValue = obj !== undefined && obj !== null;
    return { value: hasValue ? obj.value : undefined, hasValue: hasValue };
  }

  public forEachComplexPropertyOfResult(result, fn: (subResult, property: Property,
          hasValue: boolean) => void): void {
    for (const propertyName of Object.keys(this.remainingExpandBranch)) {
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
  public getSubContext(propertyName: string): QueryContext {
    /** @todo is it a good idea to create so many instances? */
    return new QueryContext(
      this.mapping.getComplexProperty(propertyName),
      this.rootTypeSchema.getProperty(propertyName).getEntityType(),
      this.remainingExpandBranch[propertyName] || {});
  }
}
