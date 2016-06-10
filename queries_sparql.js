/** @module */
var _ = require('./util');
var queries = require('./queries');
var Query = require('./queries').Query;

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
var EntitySetQuery = exports.EntitySetQuery = _.defClass(Query,
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

    var vargen = new SparqlVariableGenerator();
    var chosenEntityVar = vargen.next();

    var mapping = new StructuredSparqlVariableMapping(chosenEntityVar, vargen);
    var queryContext = new SparqlQueryContext(mapping);
    var graphPattern = new ExpandTreeGraphPattern(entityType, this.model.expandTree, mapping);
    var evaluator = new queries.QueryResultEvaluator();

    var triplePatterns = graphPattern.getTriples();

    var queryString =
        'PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> '
      + 'PREFIX disco: <http://disco-network.org/resource/> '
      + 'SELECT ' + '*' + ' WHERE {' + triplePatterns.map(function(p) { return p.join(' ') }).join(" . ") + '}';
    console.log(queryString)
    sparqlProvider.querySelect(queryString, function(answer) {
      console.log(3);
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

/**
 * @class
 * Provides a SPARQL graph pattern consisting of mandatory and optional triples.
 */
var GraphPattern = module.exports.GraphPattern = _.defClass(null,
function() {
},
{
  getTriples: _.notImplemented,
  getOptionalPatterns: _.notImplemented,
});

/**
 * @class
 * Provides a SPARQL graph pattern whose triples are directly composible
 * and manipulatable.
 */
var ComposibleGraphPattern = module.exports.ComposibleGraphPattern = _.defClass(GraphPattern,
function ComposibleGraphPattern(triples) {
  this.triples = triples || [];
  this.optionalPatterns = [];
},
{
  getTriples: function() {
    return this.triples;
  },
  getOptionalPatterns: function() {
    return this.optionalPatterns;
  },
  integratePatterns: function(patterns) {
    this.triples = _.mergeArrays([this.triples].concat(patterns
    .map(function(p) {
      return p.getTriples()
    })));

    for(var i in patterns) { this.integratePatternsAsOptional(patterns[i].getOptionalPatterns()) };
  },
  integratePatternsAsOptional: function(patterns) {
    this.optionalPatterns.push.apply(this.optionalPatterns, patterns);
  }
});

/**
 * @class
 * Provides a SPARQL graph pattern whose triples are generated from a
 * property tree
 */
var TreeGraphPattern = module.exports.TreeGraphPattern = _.defClass(null,
function TreeGraphPattern(rootName) {
  this.rootName = rootName;
  this.branches = { };
  this.optionalBranches = { };
},
{
  getTriples: function() {
    var self = this;
    var triples = [];
    for(var property in this.branches) {
      var branches = this.branches[property];
      branches.forEach(function(branch) {
        triples.push([ self.name(), property, branch.name() ]);
        triples.push.apply(triples, branch.getTriples());
      });
    }
    return triples;
  },
  getOptionalPatterns: function() {
    var self = this;
    var patterns = [];
    for(var property in this.optionalBranches) {
      var branches = this.optionalBranches[property];
      branches.forEach(function(branch) {
        var gp = new ComposibleGraphPattern([[ self.name(), property, branch.name() ]]);
        gp.integratePatterns([ branch ]);
        patterns.push(gp);
      })
    }
    return patterns;
  },
  name: function() {
    return this.rootName;
  },
  branch: function(property, arg) {
    switch(typeof arg) {
      case 'undefined': return this.branches[property];
      case 'string':
        var pat = new TreeGraphPattern(arg);
        return this.branch(property, pat);
      case 'object':
        if(this.branches[property] !== undefined)
          this.branches[property].push(arg);
        else
          this.branches[property] = [ arg ];
        return arg;
    }
  },
  optionalBranch: function(property, arg) {
    switch(typeof arg) {
      case 'undefined': return this.optionalBranches[property];
      case 'string':
        var pat = new TreeGraphPattern(arg);
        return this.optionalBranch(property, pat);
      case 'object':
        if(this.optionalBranches[property] !== undefined)
          this.optionalBranches[property].push(arg);
        else
          this.optionalBranches[property] = [ arg ];
        return arg;
    }
  },
  branchExists: function(property) {
    return this.branches[property] !== undefined;
  },
  merge: function(other) {
    var self = this;
    if(this.rootName !== other.rootName) throw new Error('can\'t merge trees with different roots');
    for(var property in other.branches) {
      other.branches[property].forEach(function(branch) {
        self.branch(property, branch);
      })
    }
    for(var property in other.optionalBranches) {
      other.optionalBranches[property].forEach(function(branch) {
        self.optionalBranch(property, branch);
      })
    }
  }
})

/**
 * @class
 * Provides a SPARQL graph pattern involving all the direct and elementary
 * properties belonging to the OData entity type passed as schema.
 */
var DirectPropertiesGraphPattern = module.exports.DirectPropertiesGraphPattern = _.defClass(TreeGraphPattern,
function(entityType, mapping) {
  var entityVariable = mapping.getVariable();
  TreeGraphPattern.call(this, entityVariable);

  var propertyNames = entityType.getPropertyNames();
  var properties = propertyNames.map(function(p) { return entityType.getProperty(p) });
  for(var i in properties) {
    var property = properties[i];
    var propertyName = property.getName();
    if(property.isNavigationProperty() === false) {
      if(!property.mirroredFromProperty()) {
        //TODO: optional
        this.branch(property.getNamespacedUri(), mapping.getElementaryPropertyVariable(propertyName));
      }
      else {
        var mirroringProperty = property.mirroredFromProperty();
        var propertyValueVar = mapping.getComplexProperty(mirroringProperty.getName()).getVariable();
        if(mirroringProperty.isOptional() == false) {
          this
            .branch(mirroringProperty.getNamespacedUri(), propertyValueVar)
            .branch('disco:id', mapping.getElementaryPropertyVariable(propertyName));
        }
        else {
          this
            .optionalBranch(mirroringProperty.getNamespacedUri(), propertyValueVar)
            .branch('disco:id', mapping.getElementaryPropertyVariable(propertyName));
        }
      }
    }
  }
},
{
});

/**
 * @class
 * Provides a SPARQL graph pattern according to an entity type schema,
 * an expand tree and a StructuredSparqlVariableMapping so that it contains
 * all the data necessary for an OData $expand query.
 */
var ExpandTreeGraphPattern = module.exports.ExpandTreeGraphPattern = _.defClass(TreeGraphPattern,
function ExpandTreeGraphPattern(entityType, expandTree, mapping) {
  var self = this;
  TreeGraphPattern.call(this, mapping.getVariable());

  var directPropertyPattern = new DirectPropertiesGraphPattern(entityType, mapping);
  var nestedPatterns = Object.keys(expandTree)
  .forEach(function(propertyName) {
    var property = entityType.getProperty(propertyName);
    var propertyType = property.getEntityType();
    //Next recursion level
    var gp = new ExpandTreeGraphPattern(propertyType, expandTree[propertyName], mapping.getComplexProperty(propertyName));
    if(property.isOptional())
      self.optionalBranch(property.getNamespacedUri(), gp);
    else
      self.branch(property.getNamespacedUri(), gp);
  });

  this.merge(directPropertyPattern);
},
{
});

/** @todo do we still need this class? */
var ExpandedPropertyGraphPattern = module.exports.ExpandedPropertyGraphPattern = _.defClass(TreeGraphPattern,
function ExpandedPropertyGraphPattern(entityType, propertyName, mapping) {
  var entityVariable = mapping.getVariable();
  TreeGraphPattern.call(this, entityVariable);

  var propertySchema = entityType.getProperty(propertyName);
  var propertyType = propertySchema.getEntityType();
  var propertyMapping = mapping.getComplexProperty(propertyName);

  var secondOrderProperties = new DirectPropertiesGraphPattern(propertyType, propertyMapping, propertyName);

  var mainTriple = [ entityVariable, propertySchema.getNamespacedUri(), propertyMapping.getVariable() ];
  if(propertySchema.isOptional() == false) {
    this.branch(propertySchema.getNamespacedUri(), secondOrderProperties);
  }
  else {
    this.optionalBranch(propertySchema.getNamespacedUri(), secondOrderProperties);
  }
},
{
});

/** @class
 * This class provides methods to interpret a SPARQL query result as OData.
 */
var SparqlQueryContext = module.exports.SparqlQueryContext = _.defClass(queries.QueryContext,
function SparqlQueryContext(mapping) { this.mapping = mapping },
{
  forEachElementaryProperty: function(result, fn) {
    this.mapping.forEachElementaryProperty(function(propertyName, variableName) {
      var obj = result[variableName.substr(1)];
      if(obj) fn(obj.value, propertyName);
    });
  },
  forEachComplexProperty: function(result, fn) {
    this.mapping.forEachComplexProperty(function(propertyName, propertyMapping) {
      if(propertyMapping.isEmpty() == false) {
        fn(result, propertyName);
      }
    });
  },
  /** Return another context associated with a complex property. */
  getSubContext: function(propertyName) {
    return new SparqlQueryContext(this.mapping.getComplexProperty(propertyName)); /** @todo is it a good idea to create so many instances? */
  }
});

/**
 * @class
 * Maps an OData property hierarchy to the corresponding SPARQL variables.
 */
var StructuredSparqlVariableMapping = module.exports.StructuredSparqlVariableMapping = _.defClass(null,
function StructuredSparqlVariableMapping(variableName, vargen) {
  this.variableName = variableName;

  var complexVargen = new ComplexSparqlVariableGenerator(vargen);
  this.elementaryProperties = new SparqlVariableMapping(vargen);
  this.complexProperties = new SparqlVariableMapping(complexVargen);
},
{
  getVariable: function() {
    return this.variableName;
  },
  /**
   * Registers an elementary property in this mapping if it does not exist yet
   * and returns the SPARQL variable name.
   */
  getElementaryPropertyVariable: function(name) {
    return this.elementaryProperties.getPropertyVariable(name);
  },
  /**
   * Registers an complex property in this mapping if it does not exist yet
   * and returns the structured mapping.
   */
  getComplexProperty: function(name) {
    return this.complexProperties.getPropertyVariable(name);
  },
  elementaryPropertyExists: function(name) {
    return this.elementaryProperties.mappingExists(name);
  },
  complexPropertyExists: function(name) {
    return this.complexProperties.mappingExists(name);
  },
  forEachElementaryProperty: function(fn) {
    this.elementaryProperties.forEach(fn);
  },
  forEachComplexProperty: function(fn) {
    this.complexProperties.forEach(fn);
  },
  isEmpty: function() {
    return this.elementaryProperties.isEmpty() && this.complexProperties.isEmpty();
  }
});

/**
 * @class
 * Maps property names to their unique SPARQL variable name.
 */
var SparqlVariableMapping = module.exports.SparqlVariableMapping = _.defClass(null,
function SparqlVariableMapping(vargen) { this.vargen = vargen },
{
  getPropertyVariable: function(propertyName) {
    this._map = this._map || {};
    return this._map[propertyName] = this._map[propertyName] || this.vargen.next();
  },
  mappingExists: function(propertyName) {
    return this._map != null && this._map[propertyName] != null;
  },
  forEach: function(fn) {
    for(var key in this._map) {
      fn(key, this._map[key]);
    }
  },
  isEmpty: function() {
    return this._map == null || this._map.length == 0;
  }
});

/**
 * @class
 * Generates instances of StructuredSparqlVariableMapping.
 */
var ComplexSparqlVariableGenerator = module.exports.ComplexSparqlVariableGenerator = _.defClass(null,
function ComplexSparqlVariableGenerator(vargen) {
  this.vargen = vargen;
},
{
  next: function() {
    return new StructuredSparqlVariableMapping(this.vargen.next(), this.vargen);
  }
});

var SparqlVariableGenerator = module.exports.SparqlVariableGenerator = _.defClass(null,
function() { this.i = -1 },
{
  next: function() {
    return '?x' + (++this.i).toString();
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
