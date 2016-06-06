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
    //var propertyPattern = new DirectPropertiesGraphPattern(chosenEntityVar, entityType, propertyVarMapping);
    var graphPattern = new ExpandTreeGraphPattern(entityType, this.model.expandTree, mapping);

    var evaluator = new SparqlMatchEvaluator();

    //var triplePatterns = [ [ chosenEntityVar, 'rdf:type', setSchema.getEntityType().getNamespacedUri() ] ];
    //triplePatterns = triplePatterns.concat(propertyPattern.getTriples());
    var triplePatterns = graphPattern.getTriples();

    var queryString =
        'PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> '
      + 'PREFIX disco: <http://disco-network.org/resource/> '
      + 'SELECT ' + '*' + ' WHERE {' + triplePatterns.map(function(p) { return p.join(' ') }).join(" . ") + '}';
    console.log(queryString);
    sparqlProvider.querySelect(queryString, function(answer) {
      if(!answer.error) {
        self.result = { result: answer.result.map(function(single) {
          /*var entity = { };
          var propertyNames = entityType.getPropertyNames();
          for(var i in propertyNames) {
            var name = propertyNames[i];
            entity[name] = mat[ mapping.getPropertyVariable(name).substr(1) ];
            entity[name] = entity[name] && entity[name].value;
          }*/
          console.log(single);
          var entity = evaluator.evaluate(single, mapping);
          console.log(entity);
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

var SparqlMatchEvaluator = module.exports.SparqlMatchEvaluator = _.defClass(null,
function SparqlMatchEvaluator() {
},
{
  evaluate: function(matchDictionary, mappingContext) {
    var self = this;
    var result = {};
    mappingContext.forEachElementaryProperty(function(propertyName, variableName) {
      console.log('elementary', propertyName, variableName, matchDictionary);
      var obj = matchDictionary[variableName.substr(1)];
      result[propertyName] = obj && obj.value;
    })
    mappingContext.forEachComplexProperty(function(propertyName, propertyMapping) {
      if(propertyMapping.isEmpty() == false) {
        result[propertyName] = self.evaluate(matchDictionary, propertyMapping);
      }
    })
    return result;
  }
});

var SparqlBuilder = _.defClass(null,
function() {
  this.vargen = new SparqlVariableGenerator();
},
{
  buildEntitySetPattern: function(entitySetName) {
  },
})

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
function GraphPattern() {
  this.triples = [];
  this.optionalTripleLists = [];
},
{
  getTriples: function() {
    return this.triples;
  },
  getOptionalTripleLists: function() {
    return this.optionalTripleLists;
  },
  integratePatterns: function(patterns) {
    this.triples = this.triples.concat(patterns
    .map(function(p) {
      return p.getTriples()
    })
    .concat([[]])
    .reduce(function(red, x) {
      return red.concat(x);
    }));
  }
});

var DirectPropertiesGraphPattern = module.exports.DirectPropertiesGraphPattern = _.defClass(GraphPattern,
function(entityType, mapping) {
  GraphPattern.call(this);

  this.triples = [];

  var entityVariable = mapping.getVariable();
  var propertyNames = entityType.getPropertyNames();
  var properties = propertyNames.map(function(p) { return entityType.getProperty(p) });
  for(var i in properties) {
    var property = properties[i];
    var propertyName = property.getName();
    if(property.isNavigationProperty() === false) {
      if(!property.mirroredFromProperty()) {
        this.triples.push([
          entityVariable,
          property.getNamespacedUri(),
          mapping.getElementaryPropertyVariable(propertyName)
        ]);
      }
      else {
        var mirroringProperty = property.mirroredFromProperty();
        var triples = [
          [ entityVariable,
            mirroringProperty.getNamespacedUri(),
            mapping.getComplexProperty(mirroringProperty.getName()).getVariable()
          ],
          [ mapping.getComplexProperty(mirroringProperty.getName()).getVariable(),
            "disco:id",
            mapping.getElementaryPropertyVariable(propertyName)
          ]
        ];
        if(mirroringProperty.isOptional() == false) {
          this.triples = this.triples.concat(triples);
        }
        else {
          this.optionalTripleLists.push(triples);
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
  this.triples = [
    [ entityVariable, propertySchema.getNamespacedUri(), propertyMapping.getVariable() ]
  ];

  var secondOrderProperties = new DirectPropertiesGraphPattern(propertyType, propertyMapping, propertyName);
  this.integratePatterns([secondOrderProperties]);
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
			res.end('unknown error type ' + result.error);
	}
}
