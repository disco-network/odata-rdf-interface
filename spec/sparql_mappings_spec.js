"use strict";
var helper = require('./helpers/sparql_mappings');
describe('unstructured odata to sparql mappings', function () {
    it('should not exist entries until they were accessed', function () {
        var mapping = helper.createUnstructuredMapping();
        expect(mapping.mappingExists('Id')).toEqual(false);
        mapping.getPropertyVariable('Id');
        expect(mapping.mappingExists('Id')).toEqual(true);
    });
    it('should call the first variable ?x0', function () {
        var mapping = helper.createUnstructuredMapping();
        var first = mapping.getPropertyVariable('Id');
        expect(first).toEqual('?x0');
    });
    it('should always return the same variable name for the same entry', function () {
        var mapping = helper.createUnstructuredMapping();
        var first = mapping.getPropertyVariable('Id');
        var second = mapping.getPropertyVariable('Id');
        expect(first).toEqual(second);
    });
    it('should always return a different variable name for different entries', function () {
        var mapping = helper.createUnstructuredMapping();
        var a = mapping.getPropertyVariable('A');
        var b = mapping.getPropertyVariable('B');
        expect(a).not.toEqual(b);
    });
});
describe('structured odata to sparql mappings', function () {
    it('should return the specified root variable name', function () {
        var mapping = helper.createStructuredMapping('?root');
        var variable = mapping.getVariable();
        expect(variable).toEqual('?root');
    });
    it('should call the first elementary property variable ?x0', function () {
        var mapping = helper.createStructuredMapping('?root');
        var variable = mapping.getElementaryPropertyVariable('Id');
        expect(variable).toEqual('?x0');
    });
    it('should call the first complex property variable ?x0', function () {
        var mapping = helper.createStructuredMapping('?root');
        var variable = mapping.getComplexProperty('Content').getVariable();
        expect(variable).toEqual('?x0');
    });
    it('should nest the mappings using complex properties', function () {
        var mapping = helper.createStructuredMapping('?root');
        var contentContentId1 = mapping.getComplexProperty('Content').getComplexProperty('Content').getElementaryPropertyVariable('Id');
        var contentContentId2 = mapping.getComplexProperty('Content').getComplexProperty('Content').getElementaryPropertyVariable('Id');
        var id = mapping.getElementaryPropertyVariable('Id');
        expect(contentContentId1).toEqual(contentContentId2);
        expect(contentContentId1).not.toEqual(id);
    });
    it('should not exist elementary properties until they were accessed', function () {
        var mapping = helper.createStructuredMapping('?root');
        expect(mapping.elementaryPropertyExists('Id')).toEqual(false);
        mapping.getElementaryPropertyVariable('Id');
        expect(mapping.elementaryPropertyExists('Id')).toEqual(true);
    });
});

//# sourceMappingURL=../maps/spec/sparql_mappings_spec.js.map
