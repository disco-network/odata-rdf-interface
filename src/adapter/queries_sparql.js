/** @module */
var _ = require('../util');
var mappings = require('./sparql_mappings');
var gpatterns = require('./sparql_graphpatterns');
var odataQueries = require('../odata/queries');

var exports = module.exports = {};

/**
 * @class
 * Used to generate query objects which can be run to modify and/or retrieve data.
 */
var QueryFactory = exports.QueryFactory = _.defClass(null,
function QueryFactory(model, schema) { this.model = model; this.schema = schema },
{
  create: function() {
    return new EntitySetQuery(this.model, this.schema);
  }
});

/**
 * @namespace
 * @name EntitySetQuery
 * @description Handles read-only OData queries.
 */
var EntitySetQuery = exports.EntitySetQuery = _.defClass(odataQueries.Query,
function EntitySetQuery(model, schema) {
  this.model = model;
  this.schema = schema;
},
{
  /** @method */
  run: function(sparqlProvider, cb) {
    var self = this;
    var setSchema = this.schema.getEntitySet(this.model.entitySetName);
    var entityType = setSchema.getEntityType();

    var vargen = new mappings.SparqlVariableGenerator();
    var chosenEntityVar = vargen.next();

    var mapping = new mappings.StructuredSparqlVariableMapping(chosenEntityVar, vargen);
    var queryContext = new SparqlQueryContext(mapping, this.model.expandTree);
    var graphPattern = new gpatterns.ExpandTreeGraphPattern(entityType, this.model.expandTree, mapping);
    var evaluator = new odataQueries.QueryResultEvaluator();

    var triplePatterns = graphPattern.getTriples();

    var queryString =
        'PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> '
      + 'PREFIX disco: <http://disco-network.org/resource/> '
      + 'SELECT ' + '*' + ' WHERE {' + triplePatterns.map(function(p) { return p.join(' ') }).join(" . ") + '}';
    console.log(queryString)
    sparqlProvider.querySelect(queryString, function(answer) {
      if(!answer.error) {
        self.result = { result: answer.result.map(function(single) {
          var entity = evaluator.evaluate(single, queryContext);
          return entity;
        }) };
      }
      else {
        self.result = { error: answer.error };
      }
      cb();
    });
  },
  /** @method
   * @description Pass the results of the query to the HTTP result object
   */
  sendResults: function(res) {
    if(!this.result.error) {
      res.writeHeader(200, { 'Content-type': 'application/json' });
      res.end(JSON.stringify(this.result.result, null, 2));
    }
    else {
      handleErrors(this.result, res);
    }
  }
});

/** @class
 * This class provides methods to interpret a SPARQL query result as OData.
 */
var SparqlQueryContext = module.exports.SparqlQueryContext = _.defClass(odataQueries.QueryContext,
function SparqlQueryContext(mapping, rootTypeSchema, remainingExpandBranch) {
  this.mapping = mapping;
  this.rootTypeSchema = rootTypeSchema;
  this.remainingExpandBranch = remainingExpandBranch;
},
{
  forEachElementaryPropertyOfResult: function(result, fn) {
    var self = this;
    this.mapping.forEachElementaryProperty(function(propertyName, variableName) {
      var obj = result[variableName.substr(1)];
      if(obj) fn(obj.value, self.rootTypeSchema.getProperty(propertyName));
    });
  },
  forEachComplexPropertyOfResult: function(result, fn) {
    for(var propertyName in this.remainingExpandBranch) {
      fn(result, this.rootTypeSchema.getProperty(propertyName));
    }
  },
  forEachElementaryPropertySchema: function(fn) {
    this.mapping.forEachComplexProperty(function(propertyName, variableName) {
      fn(this.rootTypeSchema.getProperty(propertyName));
    });
  },
  forEachComplexPropertySchema: function(fn) {
    for(var propertyName in this.remainingExpandBranch) {
      fn(this.rootTypeSchema.getProperty(propertyName));
    }
  },
  getElementaryPropertyOfResult: function(result, propertyName) {
    return result[this.mapping.getElementaryPropertyVariable(propertyName).substr(1)].value;
  },
  /** Return another context associated with a complex property. */
  getSubContext: function(propertyName) {
    /** @todo is it a good idea to create so many instances? */
    return new SparqlQueryContext(
      this.mapping.getComplexProperty(propertyName),
      this.rootTypeSchema.getProperty(propertyName).getEntityType(),
      this.remainingExpandBranch[propertyName]);
  }
});

/** Stores the query results of a SPARQL query to satisfy an OData request.
 * To the data belongs an object with the properties of quantity one and @construction */

function handleErrors(result, res) {
	switch(result.error) {
		case odataQueries.ErrorTypes.DB:
			res.statusCode = 500;
			res.end('database error ' + result.errorDetails);
			break;
		default:
			res.statusCode = 500;
      console.log(result.error.stack);
			res.end('unknown error type ' + result.error);
	}
}
