var _ = require('./util');
var queries = require('./queries');
var Query = require('./queries').Query;

var exports = module.exports = {};

var QueryFactory = exports.QueryFactory = _.defClass(null,
function QueryFactory(model, schema) { this.model = model; this.schema = schema },
{
  create: function() {
    return new EntitySetQuery(this.model, this.schema);
  }
});

var EntitySetQuery = exports.EntitySetQuery = _.defClass(Query,
function EntitySetQuery(model, schema) {
  this.model = model;
  this.schema = schema;
},
{
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
  getSubContext: function(propertyName) {
    return new SparqlQueryContext(this.mapping.getComplexProperty(propertyName)); //is it a good idea to create so many instances?
  }
});

var SparqlVariableGenerator = module.exports.SparqlVariableGenerator = _.defClass(null,
function() { this.i = -1 },
{
  next: function() {
    return '?x' + (++this.i).toString();
  }
});

var ComplexSparqlVariableGenerator = module.exports.ComplexSparqlVariableGenerator = _.defClass(null,
function ComplexSparqlVariableGenerator(vargen) {
  this.vargen = vargen;
},
{
  next: function() {
    return new StructuredSparqlVariableMapping(this.vargen.next(), this.vargen);
  }
});

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
  getElementaryPropertyVariable: function(name) {
    return this.elementaryProperties.getPropertyVariable(name);
  },
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

var GraphPattern = module.exports.GraphPattern = _.defClass(null,
function GraphPattern(triples) {
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

var DirectPropertiesGraphPattern = module.exports.DirectPropertiesGraphPattern = _.defClass(GraphPattern,
function(entityType, mapping) {
  GraphPattern.call(this);

  var entityVariable = mapping.getVariable();
  var propertyNames = entityType.getPropertyNames();
  var properties = propertyNames.map(function(p) { return entityType.getProperty(p) });
  for(var i in properties) {
    var property = properties[i];
    var propertyName = property.getName();
    if(property.isNavigationProperty() === false) {
      if(!property.mirroredFromProperty()) {
        //TODO: optional
        this.triples.push([
          entityVariable,
          property.getNamespacedUri(),
          mapping.getElementaryPropertyVariable(propertyName)
        ]);
      }
      else {
        var mirroringProperty = property.mirroredFromProperty();
        var propertyValueVar = mapping.getComplexProperty(mirroringProperty.getName()).getVariable();
        var triples = [
          [ entityVariable, mirroringProperty.getNamespacedUri(), propertyValueVar ],
          [ propertyValueVar,  "disco:id", mapping.getElementaryPropertyVariable(propertyName) ]
        ];
        if(mirroringProperty.isOptional() == false) {
          this.triples = this.triples.concat(triples);
        }
        else {
          this.integratePatternsAsOptional([new GraphPattern(triples)]);
        }
      }
    }
  }
},
{
});

var ExpandedPropertyGraphPattern = module.exports.ExpandedPropertyGraphPattern = _.defClass(GraphPattern,
function ExpandedPropertyGraphPattern(entityType, propertyName, mapping) {
  GraphPattern.call(this);
  var propertySchema = entityType.getProperty(propertyName);
  var propertyType = propertySchema.getEntityType();
  var propertyMapping = mapping.getComplexProperty(propertyName);

  var entityVariable = mapping.getVariable();
  var secondOrderProperties = new DirectPropertiesGraphPattern(propertyType, propertyMapping, propertyName);

  var mainTriple = [ entityVariable, propertySchema.getNamespacedUri(), propertyMapping.getVariable() ];
  if(propertySchema.isOptional() == false) {
    this.triples = [
      mainTriple
    ];
    this.integratePatterns([secondOrderProperties]);
  }
  else {
    var optionalGp = new GraphPattern([ mainTriple ]);
    optionalGp.integratePatterns([ secondOrderProperties ]);
    this.integratePatternsAsOptional([ optionalGp ]);
  }

},
{
});

var ExpandTreeGraphPattern = module.exports.ExpandTreeGraphPattern = _.defClass(GraphPattern,
function ExpandTreeGraphPattern(entityType, expandTree, mapping) {
  GraphPattern.call(this);

  var directPropertyPattern = new DirectPropertiesGraphPattern(entityType, mapping);
  var directPropertyPatterns = Object.keys(expandTree)
  .map(function(propertyName) {
    return new ExpandedPropertyGraphPattern(entityType, propertyName, mapping);
  });
  var nestedPatterns = Object.keys(expandTree)
  .map(function(propertyName) {
    var propertyType = entityType.getProperty(propertyName).getEntityType();
    //Next recursion level
    return new ExpandTreeGraphPattern(propertyType, expandTree[propertyName], mapping.getComplexProperty(propertyName));
  });

  this.integratePatterns([directPropertyPattern].concat(directPropertyPatterns.concat(nestedPatterns)));
},
{
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
