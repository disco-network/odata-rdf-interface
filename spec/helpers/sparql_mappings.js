var squeries = require('../../queries_sparql');

function createUnstructuredMapping() {
  var mapping = new squeries.SparqlVariableMapping(new squeries.SparqlVariableGenerator());
  return mapping;
}

function createStructuredMapping(rootVariableName) {
  var vargen = new squeries.SparqlVariableGenerator();
  var mapping = new squeries.StructuredSparqlVariableMapping(rootVariableName || vargen.next(), vargen);
  return mapping;
}

module.exports = {
  createUnstructuredMapping: createUnstructuredMapping,
  createStructuredMapping: createStructuredMapping,
}
