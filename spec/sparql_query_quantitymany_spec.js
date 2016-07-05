"use strict";
var SchemaModule = require('../src/odata/schema');
var schema = new SchemaModule.Schema();
var gpatterns = require('../src/adapter/sparql_graphpatterns');
var mhelper = require('./helpers/sparql_mappings');
describe('OData properties with quantity "many"', function () {
    it('should be integrated with UNION', function () {
        var expandTree = { Children: {} };
        var mapping = mhelper.createStructuredMapping('?post');
        var gp = new gpatterns.ExpandTreeGraphPattern(schema.getEntityType('Post'), expandTree, mapping);
        var childVar = mapping.getComplexProperty('Children').getVariable();
        expect(gp.getUnionPatterns().length).toEqual(2);
        expect(gp.getUnionPatterns()[0].inverseBranch('disco:parent').length).toEqual(1);
    });
});
