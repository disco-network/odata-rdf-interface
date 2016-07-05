"use strict";
var mappings = require('../../src/adapter/sparql_mappings');
function createUnstructuredMapping() {
    var mapping = new mappings.SparqlVariableMapping(new mappings.SparqlVariableGenerator());
    return mapping;
}
exports.createUnstructuredMapping = createUnstructuredMapping;
function createStructuredMapping(rootVariableName) {
    var vargen = new mappings.SparqlVariableGenerator();
    var mapping = new mappings.StructuredSparqlVariableMapping(rootVariableName || vargen.next(), vargen);
    return mapping;
}
exports.createStructuredMapping = createStructuredMapping;

//# sourceMappingURL=../../maps/spec/helpers/sparql_mappings.js.map
