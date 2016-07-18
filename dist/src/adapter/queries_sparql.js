"use strict";
/** @module */
var mappings = require("./mappings");
var filterPatterns = require("./filterpatterns");
var expandTreePatterns = require("./expandtree");
var filters = require("./filters");
var qsBuilder = require("./querystring_builder");
var ODataQueries = require("../odata/queries");
/**
 * Used to generate query objects which can be run to modify and/or retrieve data.
 */
var QueryFactory = (function () {
    function QueryFactory(model, schema) {
        this.model = model;
        this.schema = schema;
    }
    QueryFactory.prototype.create = function () {
        return new EntitySetQuery(this.model, this.schema);
    };
    return QueryFactory;
}());
exports.QueryFactory = QueryFactory;
/**
 * Handles read-only OData queries.
 */
var EntitySetQuery = (function () {
    function EntitySetQuery(model, schema) {
        this.model = model;
        this.schema = schema;
        this.prepareSparqlQuery();
    }
    EntitySetQuery.prototype.run = function (sparqlProvider, cb) {
        var _this = this;
        sparqlProvider.querySelect(this.queryString, function (response) {
            cb(_this.translateResponseToOData(response));
        });
    };
    EntitySetQuery.prototype.prepareSparqlQuery = function () {
        this.initializeFilterExpressionFactory();
        this.initializeQueryString();
    };
    EntitySetQuery.prototype.translateResponseToOData = function (response) {
        if (!response.error) {
            var queryContext = new SparqlQueryContext(this.getOrInitMapping(), this.getTypeOfEntitySet(), this.getExpandTree());
            var resultBuilder = new ODataQueries.JsonResultBuilder();
            return { result: resultBuilder.run(response.result, queryContext) };
        }
        else {
            return { error: response.error };
        }
    };
    EntitySetQuery.prototype.getTypeOfEntitySet = function () {
        var entitySetSchema = this.schema.getEntitySet(this.model.entitySetName);
        return entitySetSchema.getEntityType();
    };
    EntitySetQuery.prototype.initializeVariableMapping = function () {
        var vargen = new mappings.SparqlVariableGenerator();
        this.mapping = new mappings.StructuredSparqlVariableMapping(vargen.next(), vargen);
    };
    EntitySetQuery.prototype.initializeFilterExpressionFactory = function () {
        this.filterExpressionFactory = new filters.FilterExpressionFactory()
            .registerDefaultFilterExpressions()
            .setSparqlVariableMapping(this.getOrInitMapping())
            .setEntityType(this.getTypeOfEntitySet());
    };
    EntitySetQuery.prototype.initializeQueryString = function () {
        var expandGraphPattern = this.createGraphPattern();
        var filterExpression = this.createFilterExpression();
        var filterGraphPattern = this.createFilterGraphPattern(filterExpression);
        var queryStringBuilder = this.createQueryStringBuilder();
        this.queryString = queryStringBuilder.fromGraphPattern(expandGraphPattern, {
            filterExpression: filterExpression,
            filterPattern: filterGraphPattern,
        });
        console.log(this.queryString); /* @debug */
    };
    EntitySetQuery.prototype.createGraphPattern = function () {
        return expandTreePatterns.ExpandTreeGraphPatternFactory.create(this.getTypeOfEntitySet(), this.getExpandTree(), this.getOrInitMapping());
    };
    EntitySetQuery.prototype.createFilterGraphPattern = function (filterExpression) {
        if (filterExpression !== undefined)
            return filterPatterns.FilterGraphPatternFactory.create(this.createFilterContext(), filterExpression.getPropertyTree());
    };
    EntitySetQuery.prototype.createFilterExpression = function () {
        if (this.getRawFilter())
            return this.filterExpressionFactory.fromRaw(this.getRawFilter());
    };
    EntitySetQuery.prototype.createQueryStringBuilder = function () {
        var queryStringBuilder = new qsBuilder.QueryStringBuilder();
        queryStringBuilder.insertPrefix("rdf", "http://www.w3.org/1999/02/22-rdf-syntax-ns#");
        queryStringBuilder.insertPrefix("disco", "http://disco-network.org/resource/");
        return queryStringBuilder;
    };
    EntitySetQuery.prototype.createFilterContext = function () {
        return {
            mapping: this.getOrInitMapping(),
            entityType: this.getTypeOfEntitySet(),
            lambdaExpressions: {},
        };
    };
    EntitySetQuery.prototype.getExpandTree = function () {
        return this.model.expandTree;
    };
    EntitySetQuery.prototype.getRawFilter = function () {
        return this.model.filterOption;
    };
    EntitySetQuery.prototype.getOrInitMapping = function () {
        if (this.mapping === undefined) {
            this.initializeVariableMapping();
        }
        return this.mapping;
    };
    return EntitySetQuery;
}());
exports.EntitySetQuery = EntitySetQuery;
/**
 * This class provides methods to interpret a SPARQL query result as OData.
 */
var SparqlQueryContext = (function () {
    function SparqlQueryContext(mapping, rootTypeSchema, remainingExpandBranch) {
        this.mapping = mapping;
        this.rootTypeSchema = rootTypeSchema;
        this.remainingExpandBranch = remainingExpandBranch;
    }
    SparqlQueryContext.prototype.getUniqueIdOfResult = function (result) {
        var variableName = this.mapping.getElementaryPropertyVariable("Id");
        var obj = result && result[variableName.substr(1)];
        if (obj)
            return obj.value;
    };
    SparqlQueryContext.prototype.forEachPropertyOfResult = function (result, fn) {
        this.forEachElementaryPropertyOfResult(result, fn);
        this.forEachComplexPropertyOfResult(result, fn);
    };
    SparqlQueryContext.prototype.forEachElementaryPropertyOfResult = function (result, fn) {
        var _this = this;
        this.rootTypeSchema.getPropertyNames().forEach(function (propertyName) {
            var property = _this.rootTypeSchema.getProperty(propertyName);
            if (property.isNavigationProperty())
                return;
            var obj = result[_this.mapping.getElementaryPropertyVariable(propertyName).substr(1)];
            var hasValue = obj !== undefined && obj !== null;
            fn(hasValue ? obj.value : undefined, property, hasValue);
        });
    };
    SparqlQueryContext.prototype.forEachComplexPropertyOfResult = function (result, fn) {
        for (var propertyName in this.remainingExpandBranch) {
            var propertyIdVar = this.mapping.getComplexProperty(propertyName).getElementaryPropertyVariable("Id");
            var hasValue = result[propertyIdVar.substr(1)] !== undefined;
            fn(result, this.rootTypeSchema.getProperty(propertyName), hasValue);
        }
    };
    SparqlQueryContext.prototype.forEachPropertySchema = function (fn) {
        this.forEachElementaryPropertySchema(fn);
        this.forEachComplexPropertySchema(fn);
    };
    SparqlQueryContext.prototype.forEachElementaryPropertySchema = function (fn) {
        var _this = this;
        this.rootTypeSchema.getPropertyNames().forEach(function (propertyName) {
            var property = _this.rootTypeSchema.getProperty(propertyName);
            if (!property.isNavigationProperty())
                fn(property);
        });
    };
    SparqlQueryContext.prototype.forEachComplexPropertySchema = function (fn) {
        for (var propertyName in this.remainingExpandBranch) {
            fn(this.rootTypeSchema.getProperty(propertyName));
        }
    };
    SparqlQueryContext.prototype.getElementaryPropertyOfResult = function (result, propertyName) {
        return result[this.mapping.getElementaryPropertyVariable(propertyName).substr(1)].value;
    };
    /** Return another context associated with a complex property. */
    SparqlQueryContext.prototype.getSubContext = function (propertyName) {
        /** @todo is it a good idea to create so many instances? */
        return new SparqlQueryContext(this.mapping.getComplexProperty(propertyName), this.rootTypeSchema.getProperty(propertyName).getEntityType(), this.remainingExpandBranch[propertyName]);
    };
    return SparqlQueryContext;
}());
exports.SparqlQueryContext = SparqlQueryContext;

//# sourceMappingURL=../../../maps/src/adapter/queries_sparql.js.map
