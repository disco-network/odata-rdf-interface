import base = require("../odata/repository");
import { EntitySet, EntityType, Property, EntityKind, Schema } from "../odata/schema";
import { LambdaVariableScope } from "../odata/filters/filters";
import {
  IValue, IEqExpression, IStringLiteral, INumericLiteral, IPropertyValue,
  IAndExpressionVisitor, IEqExpressionVisitor, IStringLiteralVisitor, INumericLiteralVisitor, IPropertyValueVisitor,
  INullVisitor,
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
  ISelectQueryStringProducer, IInsertQueryStringProducer, IPrefixProducer, IGraphPatternStringProducer,
  ISparqlLiteral,
  SparqlString, SparqlNumber, SparqlUri, SparqlNamespacedUri, SparqlVariable,
} from "../sparql/querystringproducer";

import translators = require("../adapter/filtertranslators");
import { IEqualsUriExpression, IEqualsUriExpressionVisitor } from "../adapter/filtertranslators";
import filterPatterns = require("../adapter/filterpatterns");
import { IFilterFromPatternProducer, IMatchPattern } from "../odata/filters/matchpattern";
import { IExpandTreeGraphPatternStrategy } from "../adapter/expandtree";
import { PropertySelectionTree } from "../odata/propertyselector";
import mappings = require("../adapter/mappings");
import { ForeignKeyPropertyResolver } from "../odata/foreignkeyproperties";

import results = require("../result");

/* @smell */
const prefixes = [
  { prefix: "rdf", uri: "http://www.w3.org/1999/02/22-rdf-syntax-ns#" },
  { prefix: "disco", uri: "http://disco-network.org/resource/" },
];

export interface IMinimalVisitor extends IAndExpressionVisitor, IEqExpressionVisitor,
  IStringLiteralVisitor, INumericLiteralVisitor, IPropertyValueVisitor, IEqualsUriExpressionVisitor, INullVisitor { }

export class ODataRepository<TExpressionVisitor extends IMinimalVisitor>
  implements base.IRepository<TExpressionVisitor> {

  constructor(
    private sparqlProvider: sparqlProvider.ISparqlProvider,
    private getQueryStringBuilder: IGetQueryStringBuilder<TExpressionVisitor>,
    private insertQueryStringBuilder: IInsertQueryStringProducer,
    private patchQueryStringProducerFactory: IPatchQueryStringProducerFactory) { }

  public batch(ops: ReadonlyArray<base.IOperation>, schema: Schema, cbResults: (results: results.AnyResult) => void) {
    async.reduce(ops, [] as results.AnyResult[], (batchResults, op, cb) => {
      switch (op.type) {
        case "get":
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
          break;
        case "insert":
          try {
            const keyValuePairs = this.toSparqlAssignmentArray(op.value, batchResults);
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
          catch (e) {
            batchResults.push(results.Result.error(e));
            cb(null, batchResults);
          }
          break;
        case "patch":
          try {
            const diffAssignments = this.toSparqlAssignmentArray(op.diff, batchResults);
            const patternAssignments =
              Object.keys(op.pattern).map(prop => ({ property: prop, value: op.pattern[prop] }));
            this.runUpdate(schema.getEntityType(op.entityType), patternAssignments, diffAssignments, () => {
              batchResults.push(results.Result.success(null));
              cb(null, batchResults);
            });
            break;
          }
          catch (e) {
            batchResults.push(results.Result.error(e));
            cb(null, batchResults);
          }
          break;
        default:
          getNever(op, `Unexpected operation type ${op!.type}`);
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

  public toSparqlAssignmentArray(odata: base.BatchEntity, batchResults: results.AnyResult[]) {
    const assignments: { property: string, value: ISparqlLiteral }[] = [];
    for (const property of Object.keys(odata)) {
      const value = odata[property];
      const sparqlValue = this.edmOrRefToSparql(value, batchResults);
      if (sparqlValue !== null)
        assignments.push({ property: property, value: sparqlValue });
    }
    return assignments;
  }

  public edmOrRefToSparql(value: EdmLiteral | base.IBatchReference, batchResults: results.AnyResult[]) {
    if (value.type !== "ref") {
      return this.edmLiteralToSparqlLiteral(value);
    }
    else {
      const resultForValue = batchResults[value.resultIndex].result();
      if (resultForValue && resultForValue.uris && resultForValue.uris.length === 1) {
        /* @todo do we need conversion logic here? */
        return new SparqlUri(resultForValue.uris[0]);
      }
      else {
        throw new Error(`Referenced result is not single-valued.`);
      }
    }
  }

  public edmLiteralToSparqlLiteral(value: EdmLiteral): ISparqlLiteral | null {
    switch (value.type) {
      case "Edm.String":
      case "Edm.Guid":
        return new SparqlString(value.value);
      case "Edm.Int32":
        return new SparqlNumber(value.value.toString());
      case "null":
        return null;
      default:
        return getNever(value, `Unsupported EDM type ${value!.type}`);
    }
  }

  public primitiveLiteralExpressionFromValue(value: EdmLiteral):
    IStringLiteral<IMinimalVisitor> | INumericLiteral<IMinimalVisitor> {

    switch (value.type) {
      case "Edm.String":
      case "Edm.Guid":
        return new StringLiteral(value.value);
      case "Edm.Int32":
        return new NumericLiteral(value.value);
      case "null":
        throw new Error("not implemented");
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
    return new PropertyValue([name]);
  }

  public getEntities(
    entityType: EntityType,
    expandTree: any,
    filterExpression: IValue<TExpressionVisitor>,
    cb: (result: results.Result<any[], any>) => void) {

    this.runGet(entityType, expandTree, filterExpression,
      (res, model) => {
        try {
          cb(this.translateResponse(res, model, this.translateResponseToOData));
        } catch (error) {
          cb(new results.FailedResult<any, Error>(error));
        }
      });
  }

  private getEntityByUri(
    entityType: EntityType, uri: string,
    cb: (r: results.AnyResult, model: IQueryAdapterModel<TExpressionVisitor>) => void) {

    this.runGet(entityType, {}, new EqualsUriExpression<TExpressionVisitor>(uri), cb);
  }

  private runGet<T>(
    entityType: EntityType, expandTree: any, filterExpression: IValue<TExpressionVisitor>,
    cb: (result: results.Result<any, any>, model: IQueryAdapterModel<TExpressionVisitor>) => void) {

    const model: IQueryAdapterModel<TExpressionVisitor> = new QueryAdapterModel({
      entitySetType: entityType,
      filterOption: filterExpression,
      expandTree: expandTree || {},
    }); /* @todo injectable */
    const query = this.getQueryStringBuilder.fromQueryAdapterModel(model);
    this.sparqlProvider.query(query, result => {
      cb(result, model);
    });
  }

  private runUpdate(
    entityType: EntityType, pattern: { property: string; value: EdmLiteral }[],
    updatedValues: { property: string; value: ISparqlLiteral }[],
    cb: (res: results.AnyResult) => void) {

    const query = this.patchQueryStringProducerFactory.create(updatedValues, pattern, entityType).produceSparql();

    this.sparqlProvider.query(query, response => {
      cb(response);
    });
  }

  private runInsert(
    entityType: EntityType, uri: string, keyValuePairs: { property: string; value: ISparqlLiteral }[],
    cb: (res: results.AnyResult) => void) {

    const sparqlEntity = keyValuePairs.map(this.rdfRepresentationFromKeyValuePair(entityType));
    const query = this.insertQueryStringBuilder.insertAsSparql(prefixes, uri,
      new SparqlNamespacedUri(entityType.getNamespacedUri()), sparqlEntity);

    this.sparqlProvider.query(query, response => {
      cb(response.process(
        result => ({ success: true }),
        error => ({ success: false, error: error })
      ));
    });
  }

  private rdfRepresentationFromKeyValuePair(entityType: EntityType) {
    return (pair: { property: string; value: ISparqlLiteral }) => {
      const property = entityType.getProperty(pair.property);
      if (property.hasDirectRdfRepresentation() === true) {
        return {
          rdfProperty: property.getNamespacedUri(),
          inverse: false,
          value: pair.value,
        };
      }
      else {
        return {
          rdfProperty: property.getInverseProperty().getNamespacedUri(),
          inverse: true,
          value: pair.value,
        };
      }
    };
  }

  private translateResponse<T>(
    response: results.AnyResult,
    model: IQueryAdapterModel<TExpressionVisitor>,
    translateResult: (result, model: IQueryAdapterModel<TExpressionVisitor>) => T) {

    return response.process(
      result => translateResult(result, model),
      error => error
    );
  }

  private translateResonseToEntityUris(
    results: ReadonlyArray<any>,
    model: IQueryAdapterModel<TExpressionVisitor>) {

    /* @todo check token === "uri" */
    const uriMap = {};
    results.forEach(res => uriMap[res[model.getMapping().variables.getVariable().substr(1)].value] = true);
    return Object.keys(uriMap);
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
  return function (arg: V) { return x(y(arg)); };
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

      let serializeProperty = (property: Property) => {
        let propertyName = property.getName();
        let entity = this.getPropertyEntity(property, data);
        let entityExists = this.hasPropertyEntity(property, data);
        const foreignKeyProperty = property.foreignProperty();

        serialized[propertyName] = entityExists ? entity.serializeToODataJson() : null;

        if (property.getName() === "Id") {

          const entitySet = this.context.getEntitySet();
          serialized["odata.id"] =
            `${entitySet.getEntityUri()}odata/${entitySet.getName()}(${entity.serializeToODataJson()})`;
        }
        if (foreignKeyProperty !== undefined) {

          const entitySet = foreignKeyProperty.getEntityType().getEntitySet();
          serialized[`${foreignKeyProperty.getName()}@odata.navigationLinkUrl`] =
            `${entitySet.getEntityUri()}odata/${entitySet.getName()}(${entity.serializeToODataJson()})`;
        }
      };

      this.context.forEachExpandedPropertySchema(serializeProperty);

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

    let propertyName: string = property.getName();
    if (hasValueInResult) {
      try {
        data.value[propertyName].applyResult(result);
      } catch (error) {
        let message: string = "Could not apply result: Property [" + propertyName + "], Result [" + result + "] ";
        throw new Error(message + error.stack);
      }
    }
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
    if (property.isMultiplicityOne()) {
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

  forEachExpandedPropertySchema(fn: (property: Property) => void): void;
  forEachElementaryPropertySchema(fn: (property: Property) => void): void;
  forEachComplexExpandedPropertySchema(fn: (property: Property) => void): void;

  hasResultUniqueId(result): result is { __hasId; };
  getUniqueIdOfResult(result: { __hasId; }): string;
  getUniqueIdOfResult(result): string | undefined;
  getSubContext(property: string): IQueryContext;

  getEntitySet(): EntitySet;
}

export interface IGetQueryStringBuilder<TExpressionVisitor> {
  fromQueryAdapterModel(model: IQueryAdapterModel<TExpressionVisitor>);
}

export interface IUpdatedValue {
  /** @assumption elementary property */
  property: string;
  value: ISparqlLiteral;
}

export interface IPatternValue {
  property: string;
  value: ISparqlLiteral;
}

export interface IPatchQueryStringProducerFactory {
  create(updatedValues: IUpdatedValue[], pattern: IMatchPattern, entityType: EntityType): IPatchQueryStringProducer;
}

export interface IPatchQueryStringProducer {
  produceSparql(): string;
}

export class PatchQueryStringProducerFactory implements IPatchQueryStringProducerFactory {

  constructor(
    private prefixProducer: IPrefixProducer,
    private whereClauseProducer: IWhereClauseProducer,
    private filterFromPatternProducer: IFilterFromPatternProducer) { }

  public create(updatedValues: IUpdatedValue[], pattern: IMatchPattern, entityType: EntityType) {
    return new PatchQueryStringProducer(updatedValues, pattern, entityType,
      this.prefixProducer, this.whereClauseProducer,
      this.filterFromPatternProducer);
  }
}

export class PatchQueryStringProducer implements IPatchQueryStringProducer {

  private mapping: mappings.StructuredSparqlVariableMapping;

  /* @smell */
  constructor(
    private updatedValues: IUpdatedValue[], private pattern: IMatchPattern,
    private entityType: EntityType,
    private prefixProducer: IPrefixProducer,
    private whereClauseProducer: IWhereClauseProducer,
    private filterFromPatternProducer: IFilterFromPatternProducer) {
    const vargen = new mappings.SparqlVariableGenerator();
    this.mapping = new mappings.StructuredSparqlVariableMapping(vargen.next(), vargen);
  }

  public produceSparql() {
    let query = "";

    appendToQuery(this.producePrefixClause());
    appendToQuery(this.produceDeleteClause());
    appendToQuery(this.produceInsertClause());
    appendToQuery(this.produceWhereClause());

    return query;

    function appendToQuery(str: string) {
      if (str !== "" && query !== "") {
        query += " ";
      }
      query += str;
    }
  }

  public producePrefixClause() {
    return this.prefixProducer.prefixesAsSparql(prefixes);
  }

  public produceDeleteClause() {
    return `DELETE { ${this.produceTriplesToDelete()} }`;
  }

  public produceInsertClause() {
    return `INSERT { ${this.produceTriplesToInsert()} }`;
  }

  public produceWhereClause() {
    /* @construction include literals from filter pattern as triple, ex: ?x0 disco:id '1' */
    return this.whereClauseProducer.produce(this.selectProperties(), this.produceFilterTranslator(), this.entityType,
      this.mapping);
  }

  private selectProperties() {
    const selectionTree: PropertySelectionTree = {};

    for (const updatedValue of this.updatedValues) {
      selectionTree[updatedValue.property] = {};
    }

    return selectionTree;
  }

  private produceFilterTranslator() {
    return this.filterFromPatternProducer.produceFromPattern(this.pattern, this.entityType);
  }

  private produceTriplesToDelete() {
    return this.triplesAsSparql(new SparqlVariable(this.mapping.getVariableWithoutSyntax()),
      this.updatedValues.map(updatedValue => ({
        rdfProperty: this.producePropertyLiteral(updatedValue),
        inverse: this.isPropertyInverse(updatedValue),
        value: this.produceOldValueVariable(updatedValue),
      })));
  }

  private produceTriplesToInsert() {
    return this.triplesAsSparql(new SparqlVariable(this.mapping.getVariableWithoutSyntax()),
      this.updatedValues.map(updatedValue => ({
        rdfProperty: this.producePropertyLiteral(updatedValue),
        inverse: this.isPropertyInverse(updatedValue),
        value: this.produceNewValueLiteral(updatedValue),
      })));
  }

  private producePropertyLiteral(updatedValue: IUpdatedValue) {
    const property = this.retrievePropertySchema(updatedValue.property);
    return new SparqlNamespacedUri(property.getNamespacedUri());
  }

  private isPropertyInverse(updatedValue: IUpdatedValue) {
    const property = this.retrievePropertySchema(updatedValue.property);
    return property.hasDirectRdfRepresentation() === false;
  }

  private produceOldValueVariable(updatedValue: IUpdatedValue) {
    const property = this.retrievePropertySchema(updatedValue.property);
    return new SparqlVariable(this.mapping.getElementaryPropertyVariableWithoutSyntax(property.getName()));
  }

  private produceNewValueLiteral(updatedValue: IUpdatedValue) {
    return updatedValue.value;
  }

  private retrievePropertySchema(property: string) {
    return this.entityType.getProperty(property);
  }

  /* @todo see querystringbuilder.ts:insertQueryStringBuilder */
  private triplesAsSparql(
    subject: ISparqlLiteral, properties: {
      rdfProperty: ISparqlLiteral, inverse: boolean,
      value: ISparqlLiteral
    }[]): string {
    return properties.map(sparqlFromProperty).map(str => str + " .").join(" ");

    function sparqlFromProperty(p: { rdfProperty: ISparqlLiteral, inverse: boolean, value: ISparqlLiteral }) {
      const base = subject.representAsSparql();
      const property = p.rdfProperty.representAsSparql();
      const value = p.value.representAsSparql();
      return p.inverse ? `${value} ${property} ${base}` : `${base} ${property} ${value}`;
    }
  }
}

export class GetQueryStringBuilder<TExpressionVisitor> implements IGetQueryStringBuilder<TExpressionVisitor> {

  constructor(
    private filterExpressionFactory: translators.IExpressionTranslatorFactory<TExpressionVisitor>,
    private filterPatternStrategy: filterPatterns.FilterGraphPatternStrategy,
    private expandTreePatternStrategy: IExpandTreeGraphPatternStrategy,
    private sparqlSelectBuilder: ISelectQueryStringProducer) {
  }

  public fromQueryAdapterModel(model: IQueryAdapterModel<TExpressionVisitor>) {
    const expandGraphPattern = this.createExpandGraphPattern(model);

    const filterExpression = this.createFilterExpression(model);
    const filterGraphPattern = filterExpression && this.createFilterGraphPattern(model, filterExpression);

    const graphPattern = new gpatterns.TreeGraphPattern(model.getMapping().variables.getVariable());
    graphPattern.newConjunctivePattern(expandGraphPattern);
    if (filterGraphPattern) graphPattern.merge(filterGraphPattern);

    return this.sparqlSelectBuilder.fromGraphPatternAndFilterExpression(prefixes, graphPattern, filterExpression);
  }

  private createExpandGraphPattern(model: IQueryAdapterModel<TExpressionVisitor>): gpatterns.TreeGraphPattern {
    return this.expandTreePatternStrategy.create(model.getEntitySetType(),
      model.getExpandTree(), model.getMapping().variables);
  }

  private createFilterGraphPattern(
    model: IQueryAdapterModel<TExpressionVisitor>,
    filterExpression: translators.IExpressionTranslator): gpatterns.TreeGraphPattern {
    const filterGraphPattern = this.filterPatternStrategy.createPattern(model.getFilterContext(),
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

export interface IWhereClauseProducer {
  produce(selectedProperties: PropertySelectionTree, filter: IValue<IMinimalVisitor> | undefined,
    entityType: EntityType, mapping: mappings.StructuredSparqlVariableMapping): string & WhereClause;
}

export class WhereClauseProducer implements IWhereClauseProducer {

  constructor(
    private expandTreePatternStrategy: IExpandTreeGraphPatternStrategy,
    private graphPatternStringProducer: IGraphPatternStringProducer,
    private filterExpressionFactory: translators.IExpressionTranslatorFactory<IMinimalVisitor>) { }

  public produce(
    selectedProperties: PropertySelectionTree, filter: IValue<IMinimalVisitor> | undefined,
    entityType: EntityType, mapping: mappings.StructuredSparqlVariableMapping) {

    const filterContext: translators.IFilterContext = {
      scope: {
        entityType: entityType,
        lambdaVariableScope: new LambdaVariableScope(),
      },
      mapping: {
        scope: new mappings.ScopedMapping(
          new mappings.Mapping(new mappings.PropertyMapping(entityType), mapping)),
      },
    };

    const tree = this.expandTreePatternStrategy.createFromSelectionTree(entityType, mapping, selectedProperties);
    const filterTranslator = filter && this.filterExpressionFactory.create(filter, filterContext);
    const pattern = this.graphPatternStringProducer
      .buildGraphPatternStringAmendFilterExpression(tree, filterTranslator);
    return `WHERE ${pattern}` as string & WhereClause;
  }
}

export enum WhereClause { }

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

  constructor(private odata: IODataQueryModel<TExpressionVisitor>) { }

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

  constructor(
    private mapping: mappings.IStructuredSparqlVariableMapping,
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

  public forEachExpandedPropertySchema(fn: (property: Property) => void): void {
    this.forEachElementaryPropertySchema(fn);
    this.forEachComplexExpandedPropertySchema(fn);
  }

  public forEachElementaryPropertySchema(fn: (property) => void): void {
    this.rootTypeSchema.getPropertyNames().forEach(propertyName => {
      let property = this.rootTypeSchema.getProperty(propertyName);
      if (!property.isNavigationProperty()) fn(property);
    });
  }

  public forEachComplexExpandedPropertySchema(fn: (property) => void): void {
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

  public getEntitySet() {
    return this.rootTypeSchema.getEntitySet();
  }
}
