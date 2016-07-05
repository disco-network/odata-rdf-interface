import mappings = require('../../src/adapter/sparql_mappings');

export function createUnstructuredMapping() {
  let mapping = new mappings.SparqlVariableMapping(new mappings.SparqlVariableGenerator());
  return mapping;
}

export function createStructuredMapping(rootVariableName?: string) {
  let vargen = new mappings.SparqlVariableGenerator();
  let mapping = new mappings.StructuredSparqlVariableMapping(rootVariableName || vargen.next(), vargen);
  return mapping;
}