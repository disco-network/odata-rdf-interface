/** @module */
module.exports = { };
var _ = require('../util');

/**
 * @class
 * Maps an OData property hierarchy to the corresponding SPARQL variables.
 * Additionally, we use it to remember which properties will show up in the
 * query result.
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
