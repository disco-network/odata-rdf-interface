import { assert } from "chai";

import composer = require("../src/odata/querycomposer");
import schema = require("../src/odata/schema");

describe("query composer", function() {
  it("should create an expand tree", function() {
      let expandOption = [ { path: [ "A", "B", "C" ] }, { path: [ "A", "B", "D" ] }, { path: [ "A", "C" ] } ];
      let comp = new composer.QueryComposer("MyEntitySet", new schema.Schema({
        entitySets: { "MyEntitySet": { type: "MyEntity" } },
        entityTypes: { "MyEntity": {} } }));
      comp.expand(expandOption);

      assert.isDefined(comp.expandTree.A.B.C);
      assert.isDefined(comp.expandTree.A.B.D);
      assert.isDefined(comp.expandTree.A.C);
  });
});
