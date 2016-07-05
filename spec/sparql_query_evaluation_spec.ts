import SchemaModule = require('../src/odata/schema');
let schema = new SchemaModule.Schema();
import squeries = require('../src/adapter/queries_sparql');
import queries = require('../src/odata/queries');
import mhelper = require('./helpers/sparql_mappings');

describe('query context', function() {
  it('should recognize and enumerate over elementary properties', function() {
    var mapping = mhelper.createStructuredMapping('?post');
    var queryContext = new squeries.SparqlQueryContext(mapping, schema.getEntityType('Post'), { });

    var idVar = mapping.getElementaryPropertyVariable('Id');
    var answer = { };
    answer[idVar.substr(1)] = { token: "literal", value: "5" };

    var ok = false;
    queryContext.forEachElementaryPropertyOfResult(answer, function() { ok = true });

    expect(ok).toEqual(true);
  });
  it('should return me a subcontext and recognize its elementary properties', function() {
    var mapping = mhelper.createStructuredMapping('?post');
    var queryContext = new squeries.SparqlQueryContext(mapping, schema.getEntityType('Post'), { Parent: {} });

    var idVar = mapping.getComplexProperty('Parent').getElementaryPropertyVariable('Id');
    var answer = { };
    answer[idVar.substr(1)] = { token: "literal", value: "5" };

    var ok = false;
    queryContext.getSubContext('Parent').forEachElementaryPropertyOfResult(answer, function() { ok = true });

    expect(ok).toEqual(true);
  })
})

describe('match evaluator', function() {
  it('should evaluate elem. and complex properties', function() {
    var mapping = mhelper.createStructuredMapping('?post');
    var queryContext = new squeries.SparqlQueryContext(mapping, schema.getEntityType('Post'), { Parent: {} });
    var evaluator = new queries.QueryResultEvaluator();

    var idVar = mapping.getElementaryPropertyVariable('Id');
    var parentIdVar = mapping.getComplexProperty('Parent').getElementaryPropertyVariable('Id');

    var answer = {};
    answer[parentIdVar.substr(1)] = { token: "literal", value: "5" };
    answer[idVar.substr(1)] = { token: "literal", value: "1" };
    var result = evaluator.evaluate(answer, queryContext);

    expect(result.Content).toBeUndefined();
    expect(result.Id).toEqual('1');
    expect(result.Parent.Id).toEqual('5');
  })
  it('should only include complex properties which are in the expand tree', function() {
    var mapping = mhelper.createStructuredMapping('?post');
    var queryContext = new squeries.SparqlQueryContext(mapping, schema.getEntityType('Post'), {});
    var evaluator = new queries.QueryResultEvaluator();

    var parentIdVar = mapping.getComplexProperty('Parent').getElementaryPropertyVariable('Id');

    var answer = {};
    answer[parentIdVar.substr(1)] = { token: "literal", value: "5" };
    var result = evaluator.evaluate(answer, queryContext);

    expect(result.Parent).toBeUndefined();
  })
})