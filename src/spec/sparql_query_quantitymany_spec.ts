import { assert } from "chai";

import SchemaModule = require("../lib/odata/schema");
let schema = new SchemaModule.Schema();
import mhelper = require("./helpers/sparql_mappings");
import propertyTreeConfiguration = require("../lib/bootstrap/adapter/propertytree");

describe('OData properties with quantity "many"', function() {
  it("should be integrated with UNION", function() {
    let expandTree = { Children: {} };
    let mapping = mhelper.createStructuredMapping("?post");
    let expandPatternStrategy = propertyTreeConfiguration.getExpandTreeGraphPatternStrategy();
    let gp = expandPatternStrategy.create(schema.getEntityType("Post"),
      expandTree, mapping);

    assert.strictEqual(gp.getUnionPatterns().length >= 2, true);
    assert.strictEqual(gp.getUnionPatterns()[3].inverseBranch("disco:parent").length, 1);
  });
});
