import { assert } from "chai";

import SchemaModule = require("../lib/odata/schema");
let schema = new SchemaModule.Schema();

describe("schema", function() {
  it("should give me the entity type schema of Post", function() {
    assert.isDefined(schema.getEntityType("Post"));
  });

  it('should assign "Post.Content" the quantity one', function() {
    assert.strictEqual(schema.getEntityType("Post").getProperty("Content").isMultiplicityOne(), true);
  });
});
