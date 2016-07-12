"use strict";
/** @module */
var mappings = require("./sparql_mappings");
var gpatterns = require("./sparql_graphpatterns");
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
    }
    EntitySetQuery.prototype.run = function (sparqlProvider, cb) {
        var _this = this;
        var setSchema = this.schema.getEntitySet(this.model.entitySetName);
        var entityType = setSchema.getEntityType();
        var vargen = new mappings.SparqlVariableGenerator();
        var chosenEntityVar = vargen.next();
        var mapping = new mappings.StructuredSparqlVariableMapping(chosenEntityVar, vargen);
        var queryContext = new SparqlQueryContext(mapping, entityType, this.model.expandTree);
        var graphPattern = new gpatterns.ExpandTreeGraphPattern(entityType, this.model.expandTree, mapping);
        var evaluator = new ODataQueries.QueryResultEvaluator();
        var queryStringBuilder = new qsBuilder.QueryStringBuilder();
        queryStringBuilder.insertPrefix("rdf", "http://www.w3.org/1999/02/22-rdf-syntax-ns#");
        queryStringBuilder.insertPrefix("disco", "http://disco-network.org/resource/");
        var queryString = queryStringBuilder.fromGraphPattern(graphPattern);
        sparqlProvider.querySelect(queryString, function (answer) {
            if (!answer.error) {
                _this.result = { result: evaluator.evaluate(answer.result, queryContext) };
            }
            else {
                _this.result = { error: answer.error };
            }
            cb(_this.result);
        });
    };
    return EntitySetQuery;
}());
exports.EntitySetQuery = EntitySetQuery;
/** @class
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
        var obj = result[variableName.substr(1)];
        if (obj)
            return obj.value;
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
