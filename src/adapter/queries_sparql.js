/** @module */
var _ = require('../util');
var mappings = require('./sparql_mappings');
var gpatterns = require('./sparql_graphpatterns');
var queries = require('../odata/queries');

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
var EntitySetQuery = exports.EntitySetQuery = _.defClass(queries.Query,
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
    var evaluator = new queries.QueryResultEvaluator();

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
var SparqlQueryContext = module.exports.SparqlQueryContext = _.defClass(queries.QueryContext,
function SparqlQueryContext(mapping, remainingExpandBranch) {
  this.mapping = mapping;
  this.remainingExpandBranch = remainingExpandBranch;
},
{
  forEachElementaryProperty: function(result, fn) {
    this.mapping.forEachElementaryProperty(function(propertyName, variableName) {
      var obj = result[variableName.substr(1)];
      if(obj) fn(obj.value, propertyName);
    });
  },
  forEachComplexProperty: function(result, fn) {
    /*this.mapping.forEachComplexProperty(function(propertyName, propertyMapping) {
      if(propertyMapping.isEmpty() == false) {
        fn(result, propertyName);
      }
    });*/
    for(var propertyName in this.remainingExpandBranch) {
      var propertyMapping = this.mapping.getComplexProperty(propertyName);
      if(propertyMapping.isEmpty() == false) {
        fn(result, propertyName);
      }
    }
  },
  /** Return another context associated with a complex property. */
  getSubContext: function(propertyName) {
    /** @todo is it a good idea to create so many instances? */
    return new SparqlQueryContext(this.mapping.getComplexProperty(propertyName), this.remainingExpandBranch[propertyName]);
  }
});

function handleErrors(result, res) {
	switch(result.error) {
		case queries.ErrorTypes.DB:
			res.statusCode = 500;
			res.end('database error ' + result.errorDetails);
			break;
		default:
			res.statusCode = 500;
      console.log(result.error.stack);
			res.end('unknown error type ' + result.error);
	}
}
