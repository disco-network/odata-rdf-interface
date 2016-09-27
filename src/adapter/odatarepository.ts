import base = require("../odata/repository");
import { EntityType, Property, EntityKind, Schema } from "../odata/schema";
import { LambdaVariableScope } from "../odata/filters/filters";
import {
  IValue, IEqExpression, IStringLiteral, INumericLiteral, IPropertyValue,
  IAndExpressionVisitor, IEqExpressionVisitor, IStringLiteralVisitor, INumericLiteralVisitor, IPropertyValueVisitor,
} from "../odata/filters/expressions";
import {
  EqExpression, AndExpression, StringLiteral, NumericLiteral, PropertyValue,
} from "../odata/parser";
import {
  IQueryModel as IODataQueryModel,
} from "../odata/queries";
import { EdmLiteral } from "../odata/edm";
import * as async from "async";

import sparqlProvider = require("../sparql/sparql_provider_base");
import gpatterns = require("../sparql/graphpatterns");
import {
  ISelectQueryStringBuilder, IInsertQueryStringBuilder,
  ISparqlLiteral,
  SparqlString, SparqlNumber, SparqlUri,
} from "../sparql/querystringbuilder";

import postQueries = require("../adapter/postquery");
import translators = require("../adapter/filtertranslators");
import { IEqualsUriExpression, IEqualsUriExpressionVisitor } from "../adapter/filtertranslators";
import filterPatterns = require("../adapter/filterpatterns");
import expandTreePatterns = require("../adapter/expandtree");
import mappings = require("../adapter/mappings");
import { ForeignKeyPropertyResolver } from "../odata/foreignkeyproperties";

import results = require("../result");

/* @smell */
const prefixes = [
  { prefix: "rdf", uri: "http://www.w3.org/1999/02/22-rdf-syntax-ns#" },
  { prefix: "disco", uri: "http://disco-network.org/resource/" },
];

export interface IMinimalVisitor extends IAndExpressionVisitor, IEqExpressionVisitor,
  IStringLiteralVisitor, INumericLiteralVisitor, IPropertyValueVisitor, IEqualsUriExpressionVisitor {}

export class ODataRepository<TExpressionVisitor extends IMinimalVisitor>
  implements base.IRepository<TExpressionVisitor> {

  constructor(private sparqlProvider: sparqlProvider.ISparqlProvider,
              private getQueryStringBuilder: IGetQueryStringBuilder<TExpressionVisitor>,
              private postQueryStringBuilder: postQueries.IQueryStringBuilder,
              private insertQueryStringBuilder: IInsertQueryStringBuilder) {}

  public batch(ops: base.IOperation[], schema: Schema, cbResults: (results: results.AnyResult) => void) {
    async.reduce(ops, [] as results.AnyResult[], (batchResults, op, cb) => {
      if (this.isGetOp(op)) {
        const entityType = schema.getEntityType(op.entityType);
        const conditions = Object.keys(op.pattern).map(compose(
            (key: string) => ({ key: key, value: op.pattern[key] }),
            this.eqExpressionFromKeyValue));
        const firstCondition = conditions.slice(0, 1)[0];
        const restConditions = conditions.slice(1);
        const filterExpression = restConditions.reduce<IValue<IMinimalVisitor>>((reduced, condition) =>
          new AndExpression(reduced, condition), firstCondition);

        this.runGet(entityType, {}, filterExpression, (res, m) => {
          batchResults.push(this.translateResponse(res, m, (result, model) => ({
            odata: this.translateResponseToOData(result, model),
            uris: this.translateResonseToEntityUris(result, model),
          })));
          cb(null, batchResults);
        });
      }
      else if (this.isInsertOp(op)) {
        /* @todo @important what about inverse properties??? */
        const keyValuePairs: { property: string, value: ISparqlLiteral }[] = [];
        let errored = false;
        for (const property of Object.keys(op.value)) {
          const value = op.value[property];
          switch (value.type) {
            case "Edm.String":
              if (value.value !== null)
                keyValuePairs.push({ property: property, value: new SparqlString(value.value) });
              break;
            case "Edm.Int32":
              if (value.value !== null)
                keyValuePairs.push({ property: property, value: new SparqlNumber(value.value.toString()) });
              break;
            case "Edm.Guid":
              if (value.value !== null)
                keyValuePairs.push({ property: property, value: new SparqlString(value.value) });
              break;
            case "ref":
              const resultForValue = batchResults[value.resultIndex].result();
              if (resultForValue && resultForValue.uris && resultForValue.uris.length === 1) {
                /* @todo do we need conversion logic here? */
                keyValuePairs.push({ property: property, value: new SparqlUri(resultForValue.uris[0]) });
              }
              else {
                batchResults.push(results.Result.error("referenced result is not single-valued"));
                errored = true;
                break;
              }
              break;
            default:
              getNever(value, `${value["type"]} is not a valid type for the property ${property}.`);
          }
        }

        if (errored === true) return cb(null, batchResults);

        this.runInsert(schema.getEntityType(op.entityType), /* @todo make uri */ op.identifier,
          keyValuePairs, () => {
            this.getEntityByUri(schema.getEntityType(op.entityType), op.identifier, (res, m) => {
              batchResults.push(this.translateResponse(res, m, (result, model) => ({
                odata: this.translateResponseToOData(result, model),
                uris: this.translateResonseToEntityUris(result, model),
              })));
              cb(null, batchResults);
            });
          });
      }
    }, (err, batchResults) => {
      cbResults(results.Result.success(batchResults));
    });
  }

  public eqExpressionFromKeyValue = (pair: { key: string; value: EdmLiteral }): IEqExpression<IMinimalVisitor> => {
    return new EqExpression(
      this.propertyExpressionFromName(pair.key),
      this.primitiveLiteralExpressionFromValue(pair.value)
    );
  }

  public primitiveLiteralExpressionFromValue(value: EdmLiteral):
    IStringLiteral<IMinimalVisitor> | INumericLiteral<IMinimalVisitor> {

    switch (value.type) {
      case "Edm.String":
      case "Edm.Guid":
        return new StringLiteral(value.value);
      case "Edm.Int32":
        return new NumericLiteral(value.value);
      default:
        getNever(value, "Unsupported EDM value");
    }

    if (typeof value === "string") {
      return new StringLiteral(value);
    }
    else if (typeof value === "number") {
      return new NumericLiteral(value);
    }
    else throw new Error("value has to be string | number");
  }

  public propertyExpressionFromName(name: string): IPropertyValue<IMinimalVisitor> {
    return new PropertyValue([ name ]);
  }

  public getEntities(entityType: EntityType, expandTree: any, filterExpression: IValue<TExpressionVisitor>,
                     cb: (result: results.Result<any[], any>) => void) {
    this.runGet(entityType, expandTree, filterExpression,
      (res, model) => cb(this.translateResponse(res, model, this.translateResponseToOData)));
  }

  /* @deprecated */
  public insertEntity(entity: any, type: EntityType, cb: (result: results.AnyResult) => void) {
    this.sparqlProvider.query(this.postQueryStringBuilder.build(entity, type), result => {
      cb(result.process(res => "ok", err => ({ message: "sparql error", error: err })));
    });
  }

  private isGetOp(op: base.IOperation): op is base.IGetOperation {
    return op.type === "get";
  }

  private isInsertOp(op: base.IOperation): op is base.IInsertOperation {
    return op.type === "insert";
  }

  private getEntityByUri(entityType: EntityType, uri: string,
                         cb: (r: results.AnyResult, model: IQueryAdapterModel<TExpressionVisitor>) => void) {
    this.runGet(entityType, {}, new EqualsUriExpression<TExpressionVisitor>(uri), cb);
  }

  private runGet<T>(entityType: EntityType, expandTree: any, filterExpression: IValue<TExpressionVisitor>,
                    cb: (result: results.Result<any, any>, model: IQueryAdapterModel<TExpressionVisitor>) => void) {
    const model: IQueryAdapterModel<TExpressionVisitor> = new QueryAdapterModel({
      entitySetType: entityType,
      filterOption: filterExpression,
      expandTree: expandTree || {},
    }); /* @todo injectable */
    this.sparqlProvider.query(this.getQueryStringBuilder.fromQueryAdapterModel(model), result => {
      cb(result, model);
    });
  }

  private runInsert(entityType: EntityType, uri: string, keyValuePairs: { property: string; value: ISparqlLiteral }[],
                    cb: (res: results.AnyResult) => void) {

    const sparqlEntity = keyValuePairs.map(p => ({
      rdfProperty: entityType.getProperty(p.property).getNamespacedUri(),
      value: p.value,
    }));
    const query = this.insertQueryStringBuilder.insertAsSparql(prefixes, uri, sparqlEntity);

    this.sparqlProvider.query(query, response => {
      cb(response.process(
        result => ({ success: true }),
        error => ({ success: false, error: error })
      ));
    });
  }

  private translateResponse<T>(response: results.AnyResult,
                               model: IQueryAdapterModel<TExpressionVisitor>,
                               translateResult: (result, model: IQueryAdapterModel<TExpressionVisitor>) => T) {
    return response.process(
      result => translateResult(result, model),
      error => error
    );
  }

  private translateResonseToEntityUris(results,
                                       model: IQueryAdapterModel<TExpressionVisitor>) {
    /* @todo check token === "uri" */
    return results.map(res => res[model.getMapping().variables.getVariable().substr(1)].value);
  }

  private translateResponseToOData = (results,
                                      model: IQueryAdapterModel<TExpressionVisitor>) => {
    return this.translateSuccessfulResponseToOData(results, model);
  }

  private translateSuccessfulResponseToOData(response: any, model: IQueryAdapterModel<TExpressionVisitor>) {
    let queryContext = new QueryContext(model.getMapping().variables,
      model.getEntitySetType(), model.getExpandTree());
    let resultBuilder = new JsonResultBuilder();
    return resultBuilder.run(response, queryContext);
  }
}

function getNever(value: never, msg: string): never {
  throw new Error(msg);
}

class EqualsUriExpression<T extends IEqualsUriExpressionVisitor> implements IEqualsUriExpression<T> {

  constructor(private uri: string) {
  }

  public accept(visitor: T) {
    visitor.visitEqualsUriExpression(this);
  }

  public getUri() {
    return this.uri;
  }
}

function compose<T, U, V>(y: (arg: V) => U, x: (arg: U) => T): (arg: V) => T {
  return function(arg: V) { return x(y(arg)); };
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

    if (this.context.hasResultUniqueId(result)) {
      let id = this.context.getUniqueIdOfResult(result);
      if (!Object.prototype.hasOwnProperty.call(this.entities, id)) {

        this.entities[id] = EntityFactory.fromEntityKind(this.kind, this.context);
      }

      this.entities[id].applyResult(result);
    }
  }

  public serializeToODataJson() {
    return Object.keys(this.entities).map(id => this.entities[id].serializeToODataJson());
  }
}

export interface ComplexEntityData {
  value: { [id: string]: IEntityValue };
  id: any;
}

export class ComplexEntity implements IEntityValue {
  private context: IQueryContext;
  private data?: ComplexEntityData = undefined;

  constructor(context: IQueryContext) {
    this.context = context;
  }

  public applyResult(result: any): void {

    if (this.context.hasResultUniqueId(result)) {
      const resultId = this.context.getUniqueIdOfResult(result);

      const data = this.getOrInitDataWithResultId(resultId);
      this.context.forEachPropertyOfResult(result, (resultOfProperty, property, hasValueInResult) => {
        this.applyResultToProperty(resultOfProperty, property, hasValueInResult, data);
      });
    }
  }

  public serializeToODataJson(): any {
    const data = this.data;
    if (data === undefined) return null;
    else {
      let serialized = {};

      let serializeProperty = property => {
        let propertyName = property.getName();
        let entity = this.getPropertyEntity(property, data);
        let entityExists = this.hasPropertyEntity(property, data);
        serialized[propertyName] = entityExists ? entity.serializeToODataJson() : null;
      };

      this.context.forEachPropertySchema(serializeProperty);

      return serialized;
    }
  }

  private isFirstResultOrSameId(id) {
    return this.data === undefined || this.data.id === id;
  }

  private getOrInitDataWithResultId(id) {
    if (this.isFirstResultOrSameId(id)) {
      if (this.data === undefined) {
        this.data = {
          id: id,
          value: {},
        };
      }
      return this.data;
    }
    else throw new Error("found different values for a property of quantity one");
  }

  private applyResultToProperty(result: any, property: Property, hasValueInResult: boolean, data: ComplexEntityData) {
    if (!this.hasPropertyEntity(property, data)) {
      this.setPropertyEntity(property,
        EntityFactory.fromPropertyWithContext(property, this.context), data);
    }

    if (hasValueInResult) data.value[property.getName()].applyResult(result);
  }

  private hasPropertyEntity(property: Property, data: ComplexEntityData) {
    return this.getPropertyEntity(property, data) !== undefined;
  }

  private getPropertyEntity(property: Property, data: ComplexEntityData) {
    return data.value[property.getName()];
  }

  private setPropertyEntity(property: Property, value, data: ComplexEntityData) {
    data.value[property.getName()] = value;
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

  hasResultUniqueId(result): result is { __hasId; };
  getUniqueIdOfResult(result: { __hasId; }): string;
  getUniqueIdOfResult(result): string | undefined;
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
    let filterGraphPattern = filterExpression && this.createFilterGraphPattern(model, filterExpression);

    let graphPattern = new gpatterns.TreeGraphPattern(model.getMapping().variables.getVariable());
    graphPattern.newConjunctivePattern(expandGraphPattern);
    if (filterGraphPattern) graphPattern.merge(filterGraphPattern);

    return this.sparqlSelectBuilder.fromGraphPatternAndFilterExpression(prefixes, graphPattern, filterExpression);
  }

  private createExpandGraphPattern(model: IQueryAdapterModel<TExpressionVisitor>): gpatterns.TreeGraphPattern {
    return this.expandTreePatternStrategy.create(model.getEntitySetType(),
      model.getExpandTree(), model.getMapping().variables);
  }

  private createFilterGraphPattern(model: IQueryAdapterModel<TExpressionVisitor>,
                                   filterExpression: translators.IExpressionTranslator): gpatterns.TreeGraphPattern {
    let filterGraphPattern = this.filterPatternStrategy.createPattern(model.getFilterContext(),
      filterExpression.getPropertyTree());
    return filterGraphPattern;
  }

  private createFilterExpression(model: IQueryAdapterModel<TExpressionVisitor>):
    translators.IExpressionTranslator | undefined {
    const filterExpression = model.getFilterExpression();
    if (filterExpression !== undefined) {
      return this.filterExpressionFactory.create(filterExpression, model.getFilterContext());
    }
  }
}

export interface IQueryAdapterModel<TVisitor> {
  getFilterContext(): translators.IFilterContext;
  getMapping(): mappings.Mapping;
  getEntitySetType(): EntityType;
  getExpandTree(): any;
  getFilterExpression(): IValue<TVisitor> | undefined;
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

  public hasResultUniqueId(result): result is { __hasId; } {
    return this.getUniqueIdOfResult(result) !== undefined;
  }

  public getUniqueIdOfResult(result: { __hasId; }): string;
  public getUniqueIdOfResult(result: any): string | undefined;

  public getUniqueIdOfResult(result): string | undefined {
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
