var mappings = require('../../sparql_mappings');

function createUnstructuredMapping() {
  var mapping = new mappings.SparqlVariableMapping(new mappings.SparqlVariableGenerator());
  return mapping;
}

function createStructuredMapping(rootVariableName) {
  var vargen = new mappings.SparqlVariableGenerator();
  var mapping = new mappings.StructuredSparqlVariableMapping(rootVariableName || vargen.next(), vargen);
  return mapping;
}

module.exports = {
  createUnstructuredMapping: createUnstructuredMapping,
  createStructuredMapping: createStructuredMapping,
}
