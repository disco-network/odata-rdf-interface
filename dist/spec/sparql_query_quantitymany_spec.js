"use strict";
var SchemaModule = require("../src/odata/schema");
var schema = new SchemaModule.Schema();
var expandTreePatterns = require("../src/adapter/expandtree");
var mhelper = require("./helpers/sparql_mappings");
describe('OData properties with quantity "many"', function () {
    it("should be integrated with UNION", function () {
        var expandTree = { Children: {} };
        var mapping = mhelper.createStructuredMapping("?post");
        var gp = expandTreePatterns.ExpandTreeGraphPatternFactory.create(schema.getEntityType("Post"), expandTree, mapping);
        expect(gp.getUnionPatterns().length).toEqual(2);
        expect(gp.getUnionPatterns()[1].inverseBranch("disco:parent").length).toEqual(1);
    });
});

//# sourceMappingURL=../../maps/spec/sparql_query_quantitymany_spec.js.map
