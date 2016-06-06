var sparqlQueries = require('../queries_sparql');

module.exports = { name: "sparql-mapping", tests: [
  { name: "elementaryProperties", run: function(tools) {
    var mapping = new sparqlQueries.StructuredSparqlVariableMapping('?main', new sparqlQueries.SparqlVariableGenerator());
    var id = mapping.getElementaryPropertyVariable('Id');
    tools.assertTrue(function() { return id === '?x0' }, id);
  } },
  { name: "navigationProperties", run: function(tools) {
    var mapping = new sparqlQueries.StructuredSparqlVariableMapping('?main', new sparqlQueries.SparqlVariableGenerator());
    var property = mapping.getComplexProperty('Parent');
    tools.assertTrue(function() { return mapping.getVariable() === '?main' }, mapping.getVariable());
    tools.assertTrue(function() { return property.getVariable() === '?x0' }, property.getVariable());
  } },
]}
