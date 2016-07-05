"use strict";
var mappings = require('./sparql_mappings');
var gpatterns = require('./sparql_graphpatterns');
var ODataQueries = require('../odata/queries');
/**
 * @class
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
 * @namespace
 * @name EntitySetQuery
 * @description Handles read-only OData queries.
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
        var triplePatterns = graphPattern.getTriples();
        var queryString = 'PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> '
            + 'PREFIX disco: <http://disco-network.org/resource/> '
            + 'SELECT ' + '*' + ' WHERE {' + triplePatterns.map(function (p) { return p.join(' '); }).join(" . ") + '}';
        console.log(queryString);
        sparqlProvider.querySelect(queryString, function (answer) {
            if (!answer.error) {
                _this.result = { result: answer.result.map(function (single) {
                        var entity = evaluator.evaluate(single, queryContext);
                        return entity;
                    }) };
            }
            else {
                _this.result = { error: answer.error };
            }
            cb();
        });
    };
    /** @method
     * @description Pass the results of the query to the HTTP result object
     */
    EntitySetQuery.prototype.sendResults = function (res) {
        if (!this.result.error) {
            res.writeHeader(200, { 'Content-type': 'application/json' });
            res.end(JSON.stringify(this.result.result, null, 2));
        }
        else {
            handleErrors(this.result, res);
        }
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
    SparqlQueryContext.prototype.forEachElementaryPropertyOfResult = function (result, fn) {
        var self = this;
        this.mapping.forEachElementaryProperty(function (propertyName, variableName) {
            var obj = result[variableName.substr(1)];
            if (obj)
                fn(obj.value, self.rootTypeSchema.getProperty(propertyName));
        });
    };
    SparqlQueryContext.prototype.forEachComplexPropertyOfResult = function (result, fn) {
        for (var propertyName in this.remainingExpandBranch) {
            fn(result, this.rootTypeSchema.getProperty(propertyName));
        }
    };
    SparqlQueryContext.prototype.forEachElementaryPropertySchema = function (fn) {
        this.mapping.forEachComplexProperty(function (propertyName, variableName) {
            fn(this.rootTypeSchema.getProperty(propertyName));
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
/** Stores the query results of a SPARQL query to satisfy an OData request.
 * To the data belongs an object with the properties of quantity one and @construction */
function handleErrors(result, res) {
    switch (result.error) {
        case ODataQueries.ErrorTypes.DB:
            res.statusCode = 500;
            res.end('database error ' + result.errorDetails);
            break;
        default:
            res.statusCode = 500;
            console.log(result.error.stack);
            res.end('unknown error type ' + result.error);
    }
}
