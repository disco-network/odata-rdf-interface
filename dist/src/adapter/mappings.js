/** @module */
"use strict";
/**
 * Maps an OData property hierarchy to the corresponding SPARQL variables.
 * Additionally, we use it to remember which properties will show up in the
 * query result.
 */
var StructuredSparqlVariableMapping = (function () {
    function StructuredSparqlVariableMapping(variableName, vargen) {
        this.variableName = variableName;
        var complexVargen = new ComplexSparqlVariableGenerator(vargen);
        this.elementaryProperties = new SparqlVariableMapping(vargen);
        this.complexProperties = new SparqlVariableMapping(complexVargen);
    }
    StructuredSparqlVariableMapping.prototype.getVariable = function () {
        return this.variableName;
    };
    /**
     * Registers an elementary property in this mapping if it does not exist yet
     * and returns the SPARQL variable name.
     */
    StructuredSparqlVariableMapping.prototype.getElementaryPropertyVariable = function (name) {
        return this.elementaryProperties.getPropertyVariable(name);
    };
    /**
     * Registers an complex property in this mapping if it does not exist yet
     * and returns the structured mapping.
     */
    StructuredSparqlVariableMapping.prototype.getComplexProperty = function (name) {
        return this.complexProperties.getPropertyVariable(name);
    };
    StructuredSparqlVariableMapping.prototype.elementaryPropertyExists = function (name) {
        return this.elementaryProperties.mappingExists(name);
    };
    StructuredSparqlVariableMapping.prototype.complexPropertyExists = function (name) {
        return this.complexProperties.mappingExists(name);
    };
    StructuredSparqlVariableMapping.prototype.forEachElementaryProperty = function (fn) {
        this.elementaryProperties.forEach(fn);
    };
    StructuredSparqlVariableMapping.prototype.forEachComplexProperty = function (fn) {
        this.complexProperties.forEach(fn);
    };
    StructuredSparqlVariableMapping.prototype.isEmpty = function () {
        return this.elementaryProperties.isEmpty() && this.complexProperties.isEmpty();
    };
    return StructuredSparqlVariableMapping;
}());
exports.StructuredSparqlVariableMapping = StructuredSparqlVariableMapping;
/**
 * Maps property names to their unique SPARQL variable name.
 */
var SparqlVariableMapping = (function () {
    function SparqlVariableMapping(vargen) {
        this.vargen = vargen;
    }
    SparqlVariableMapping.prototype.getPropertyVariable = function (propertyName) {
        this.map = this.map || {};
        return this.map[propertyName] = this.map[propertyName] || this.vargen.next();
    };
    SparqlVariableMapping.prototype.mappingExists = function (propertyName) {
        return this.map != null && this.map[propertyName] != null;
    };
    SparqlVariableMapping.prototype.forEach = function (fn) {
        for (var key in this.map) {
            fn(key, this.map[key]);
        }
    };
    SparqlVariableMapping.prototype.isEmpty = function () {
        return this.map == null || Object.keys(this.map).length === 0;
    };
    return SparqlVariableMapping;
}());
exports.SparqlVariableMapping = SparqlVariableMapping;
/**
 * Generates instances of StructuredSparqlVariableMapping.
 */
var ComplexSparqlVariableGenerator = (function () {
    function ComplexSparqlVariableGenerator(vargen) {
        this.vargen = vargen;
    }
    ComplexSparqlVariableGenerator.prototype.next = function () {
        return new StructuredSparqlVariableMapping(this.vargen.next(), this.vargen);
    };
    return ComplexSparqlVariableGenerator;
}());
exports.ComplexSparqlVariableGenerator = ComplexSparqlVariableGenerator;
var SparqlVariableGenerator = (function () {
    function SparqlVariableGenerator() {
        this.i = -1;
    }
    SparqlVariableGenerator.prototype.next = function () {
        return "?x" + (++this.i).toString();
    };
    return SparqlVariableGenerator;
}());
exports.SparqlVariableGenerator = SparqlVariableGenerator;

//# sourceMappingURL=../../../maps/src/adapter/mappings.js.map
