var schema = require('../schema');
schema = new schema.Schema();
var queries = require('../queries');
var sparqlQueries = require('../queries_sparql');

module.exports = { name: 'sparql', tests: [
  { name: 'mapping-known', run: function(tools) {
    var vargen = new sparqlQueries.SparqlVariableGenerator();
    var mapping = new sparqlQueries.StructuredSparqlVariableMapping(vargen.next(), vargen);

    tools.assertTrue(function() { return mapping.elementaryPropertyExists("Id") === false });
    mapping.getElementaryPropertyVariable("Id");
    tools.assertTrue(function() { return mapping.elementaryPropertyExists("Id") === true });
  } },
  { name: 'mapping-equals', run: function(tools) {
    var vargen = new sparqlQueries.SparqlVariableGenerator();
    var mapping = new sparqlQueries.StructuredSparqlVariableMapping(vargen.next(), vargen);

    tools.assertTrue(function() {
      return mapping.getElementaryPropertyVariable("Id") == mapping.getElementaryPropertyVariable("Id") });
  } },
  { name: 'mapping-distinct', run: function(tools) {
    var vargen = new sparqlQueries.SparqlVariableGenerator();
    var mapping = new sparqlQueries.StructuredSparqlVariableMapping(vargen.next(), vargen);
    var mapping2 = new sparqlQueries.StructuredSparqlVariableMapping(vargen.next(), vargen);

    tools.assertTrue(function() {
      return mapping.getElementaryPropertyVariable("Id") != mapping2.getElementaryPropertyVariable("Id") });
  } },
  { name: 'pattern-mappings-direct-elementary-properties', run: function(tools) {
    var Post = schema.getEntityType('Post');
    tools.assertTrue(function() { return Post != null });

    var vargen = new sparqlQueries.SparqlVariableGenerator();
    var mapping = new sparqlQueries.StructuredSparqlVariableMapping('?post', vargen);
    var pattern = new sparqlQueries.DirectPropertiesGraphPattern(Post, mapping);

    tools.assertTrue(function() { return mapping.elementaryPropertyExists("Id") === true });
    tools.assertTrue(function() { return mapping.elementaryPropertyExists("ParentId") === true });
    tools.assertTrue(function() { return mapping.elementaryPropertyExists("Parent") === false });
  } },
  { name: 'pattern-triples', run: function(tools) {
    var Post = schema.getEntityType('Post');
    tools.assertTrue(function() { return Post != null });

    var vargen = new sparqlQueries.SparqlVariableGenerator();
    var mapping = new sparqlQueries.StructuredSparqlVariableMapping('?post', vargen);
    var pattern = new sparqlQueries.DirectPropertiesGraphPattern(Post, mapping);

    tools.assertTrue(function() { return tripleEquals(pattern.getTriples()[0], [ '?post', 'disco:id', mapping.getElementaryPropertyVariable('Id') ]) },
      'first triple is incorrect: ' + pattern.getTriples()[0]);
  } },
  { name: 'expand-property-pattern', run: function(tools) {
    var Post = schema.getEntityType('Post');
    tools.assertTrue(function() { return Post != null });

    var vargen = new sparqlQueries.SparqlVariableGenerator();
    var mapping = new sparqlQueries.StructuredSparqlVariableMapping('?post', vargen);
    var pattern = new sparqlQueries.ExpandedPropertyGraphPattern(Post, "Parent", mapping);

    var t1 = [ '?post', 'disco:parent', mapping.getComplexProperty('Parent').getVariable() ];
    var t2 = [
      mapping.getComplexProperty('Parent').getVariable(),
      'disco:id',
      mapping.getComplexProperty('Parent').getElementaryPropertyVariable('Id') ];

    tools.assertTrue(function() { return mapping.complexPropertyExists("Parent") === true });
    tools.assertTrue(function() { return tripleEquals(pattern.getTriples()[0], t1) },
      'first triple is incorrect: ' + pattern.getTriples()[0]);
    tools.assertTrue(function() { return tripleEquals(pattern.getTriples()[1], t2) },
      'second triple is incorrect: ' + pattern.getTriples()[1]);
  } },
  { name: 'expand-tree-pattern', run: function(tools) {
    var Post = schema.getEntityType('Post');
    tools.assertTrue(function() { return Post != null });
    var expandTree = { Parent: {} };

    var vargen = new sparqlQueries.SparqlVariableGenerator();
    var mapping = new sparqlQueries.StructuredSparqlVariableMapping('?post', vargen);
    var pattern = new sparqlQueries.ExpandTreeGraphPattern(Post, expandTree, mapping);

    var t1 = [ '?post', 'disco:parent', mapping.getComplexProperty('Parent').getVariable() ];
    var t2 = [ mapping.getComplexProperty('Parent').getVariable(), 'disco:id',
      mapping.getComplexProperty('Parent').getElementaryPropertyVariable('Id') ];

    tools.assertTrue(function() { return mapping.complexPropertyExists("Parent") === true });
    tools.assertTrue(function() { return containsTriple(pattern.getTriples(), t1) },
      'does not contain triple #1 [' +  t1 + ']: ' + JSON.stringify(pattern.getTriples(),null,2));
    tools.assertTrue(function() { return containsTriple(pattern.getTriples(), t2) },
      'does not contain triple #2 [' + t2 + ']: ' + JSON.stringify(pattern.getTriples(),null,2));
  } },
  { name: 'expand-tree-pattern-special-case', run: function(tools) {
    var Post = schema.getEntityType('Post');
    tools.assertTrue(function() { return Post != null });
    var expandTree = { Content: { Content: {} } };

    var vargen = new sparqlQueries.SparqlVariableGenerator();
    var mapping = new sparqlQueries.StructuredSparqlVariableMapping('?post', vargen);
    var pattern = new sparqlQueries.ExpandTreeGraphPattern(Post, expandTree, mapping);

    var t1 = [ '?post', 'disco:parent', mapping.getComplexProperty('Parent').getVariable() ];
    var t2 = [ mapping.getComplexProperty('Parent').getVariable(), 'disco:id',
      mapping.getComplexProperty('Parent').getElementaryPropertyVariable('Id') ];
  } },
  { name: 'expand-nested-tree-pattern', run: function(tools) {
    var Post = schema.getEntityType('Post');
    tools.assertTrue(function() { return Post != null });
    var expandTree = { Parent: { Parent: {} } };

    var vargen = new sparqlQueries.SparqlVariableGenerator();
    var mapping = new sparqlQueries.StructuredSparqlVariableMapping('?post', vargen);
    var pattern = new sparqlQueries.ExpandTreeGraphPattern(Post, expandTree, mapping);

    tools.assertTrue(function() { return mapping.getComplexProperty("Parent").complexPropertyExists("Parent") === true });
    var t1 = [
      mapping.getComplexProperty('Parent').getVariable(),
      'disco:parent',
      mapping.getComplexProperty('Parent').getComplexProperty('Parent').getVariable() ];
    var t2 = [
      '?post',
      'disco:id',
      mapping.getElementaryPropertyVariable('Id')
    ]

    tools.assertTrue(function() { return containsTriple(pattern.getTriples(), t1) },
      'does not contain triple #1 [' + t1 + ']:' + JSON.stringify(pattern.getTriples(), null, 2) + '\n\n' +
      JSON.stringify(mapping._map));
    tools.assertTrue(function() { return containsTriple(pattern.getTriples(), t2) },
      'does not contain triple #2 [' + t2 + ']:' + JSON.stringify(pattern.getTriples(), null, 2) + '\n\n' +
      JSON.stringify(mapping._map));
  } },
  { name: 'mirrored-properties', run: function(tools) {
    var Post = schema.getEntityType('Post');
    tools.assertTrue(function() { return Post != null });

    var vargen = new sparqlQueries.SparqlVariableGenerator();
    var mapping = new sparqlQueries.StructuredSparqlVariableMapping('?post', vargen);
    var pattern = new sparqlQueries.DirectPropertiesGraphPattern(Post, mapping);

    var t2 = [ '?post', 'disco:content', mapping.getComplexProperty('Content').getVariable() ];
    var t3 = [ mapping.getComplexProperty('Content').getVariable(),
      'disco:id',
      mapping.getElementaryPropertyVariable('ContentId') ];
    tools.assertTrue(function() { return tripleEquals(pattern.getTriples()[1], t2) },
      'second triple is incorrect: ' + pattern.getTriples()[1]);
    tools.assertTrue(function() { return tripleEquals(pattern.getTriples()[2], t3) },
      'third triple is incorrect: ' + pattern.getTriples()[2]);
  } },
  { name: 'sparql-query-context', run: function(tools) {
    var vargen = new sparqlQueries.SparqlVariableGenerator();
    var mapping = new sparqlQueries.StructuredSparqlVariableMapping('?post', vargen);
    var queryContext = new sparqlQueries.SparqlQueryContext(mapping);

    var idVar = mapping.getElementaryPropertyVariable('Id');
    var answer = { };
    answer[idVar.substr(1)] = { token: "literal", value: "5" };

    var ok = false;
    queryContext.forEachElementaryProperty(answer, function() { ok = true });
    tools.assertTrue(ok);
  } },
  { name: 'sparql-query-sub-context', run: function(tools) {
    var vargen = new sparqlQueries.SparqlVariableGenerator();
    var mapping = new sparqlQueries.StructuredSparqlVariableMapping('?post', vargen);
    var queryContext = new sparqlQueries.SparqlQueryContext(mapping);

    var parentVar = mapping.getComplexProperty('Parent').getVariable();
    var idVar = mapping.getComplexProperty('Parent').getElementaryPropertyVariable('Id');
    var answer = { };
    answer[idVar.substr(1)] = { token: "literal", value: "5" };

    var ok = false;
    queryContext.getSubContext('Parent').forEachElementaryProperty(answer, function() { ok = true });
    tools.assertTrue(ok);
  } },
  { name: 'match-evaluator-elementary-properties', run: function(tools) {
    var vargen = new sparqlQueries.SparqlVariableGenerator();
    var mapping = new sparqlQueries.StructuredSparqlVariableMapping('?post', vargen);
    var queryContext = new sparqlQueries.SparqlQueryContext(mapping);
    var evaluator = new queries.QueryResultEvaluator();

    var idVar = mapping.getElementaryPropertyVariable('Id');

    var answer = {};
    answer[idVar.substr(1)] = { token: "literal", value: "5" };
    var result = evaluator.evaluate(answer, queryContext);

    tools.assertTrue(function() { return result.Id == "5" }, json(result))
  } },
  { name: 'match-evaluator-complex-properties', run: function(tools) {
    var vargen = new sparqlQueries.SparqlVariableGenerator();

    var mapping = new sparqlQueries.StructuredSparqlVariableMapping('?post', vargen);
    var queryContext = new sparqlQueries.SparqlQueryContext(mapping);
    var evaluator = new queries.QueryResultEvaluator();

    var idVar = mapping.getElementaryPropertyVariable('Id');
    var parentIdVar = mapping.getComplexProperty('Parent').getElementaryPropertyVariable('Id');

    var answer = {};
    answer[parentIdVar.substr(1)] = { token: "literal", value: "5" };
    answer[idVar.substr(1)] = { token: "literal", value: "1" };
    var result = evaluator.evaluate(answer, queryContext);

    tools.assertTrue(function() { return result.Content == null });
    tools.assertTrue(function() { return result.Id == "1" }, json(result));
    tools.assertTrue(function() { return result.Parent.Id == "5" });
  } },
  { name: 'optional-properties', run: function(tools) {
    var vargen = new sparqlQueries.SparqlVariableGenerator();

    var mapping = new sparqlQueries.StructuredSparqlVariableMapping('?post', vargen);
    var pattern = new sparqlQueries.DirectPropertiesGraphPattern(schema.getEntityType('Post'), mapping);

    tools.assertTrue(function() { return pattern.getOptionalTripleLists().length != 0 });
    tools.assertTrue(function() { return mapping.elementaryPropertyExists('ParentId') == true });

    assertTriples(pattern.getOptionalTripleLists()[0], [
      [ '?post', 'disco:parent', mapping.getComplexProperty('Parent').getVariable() ],
      [ mapping.getComplexProperty('Parent').getVariable(), 'disco:id', mapping.getElementaryPropertyVariable('ParentId') ]
    ]);
  } },
  { name: 'optional-properties-integrate-patterns', run: function(tools) {
    var innerPattern = new sparqlQueries.GraphPattern();
    innerPattern.optionalTripleLists.push(['a', 'b', 'c']);

    var outerPattern = new sparqlQueries.GraphPattern();
    outerPattern.integratePatterns([innerPattern]);

    tools.assertTrue(function() { return outerPattern.optionalTripleLists.length == 1 });
  } },
] };

function assertTriples(col, triples) {
  for(var i in triples) {
    if(!containsTriple(col, triples[i]))
      throw new Error('triple #' + i + ' is incorrect: ' + triples[i] + '\ncollection: ' + json(col));
  }
}

function containsTriple(col, t) {
  for(var i in col) {
    if(tripleEquals(col[i], t)) return true;
  }
  return false;
}

function tripleEquals(t1, t2) {
  return t1[0] == t2[0] && t1[1] == t2[1] && t1[2] == t2[2];
}

function json(obj) {
  return JSON.stringify(obj, null, 2);
}
