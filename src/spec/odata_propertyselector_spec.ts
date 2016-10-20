import { assert } from "../lib/assert";
import { PropertySelector } from "../lib/odata/propertyselector";
import { Schema } from "../lib/odata/schema";

describe("PropertySelector:", () => {
  it ("should select direct complex properties included in the expand tree", () => {
    const selector = new PropertySelector();
    const schema = new Schema();
    const selectionTree = selector.selectPropertiesForQuery(schema.getEntityType("Post"), { Content: {} });

    assert.strictEqual(Object.prototype.hasOwnProperty.call(selectionTree, "Content"), true, "include Content");
  });
});
