var composer = require('../src/odata/querycomposer');

describe("query composer", function() {
  it("should create an expand tree", function() {
      var expandOption = [ { path: [ "A", "B", "C" ] }, { path: [ "A", "B", "D" ] }, { path: [ "A", "C" ] } ];
      var comp = new composer.QueryComposer('MyEntitySet', { entitySets: { 'MyEntitySet': {} } });
      comp.expand(expandOption);

      expect(comp.expandTree.A.B.C).toBeDefined()
      expect(comp.expandTree.A.B.D).toBeDefined()
      expect(comp.expandTree.A.C).toBeDefined()
  })
})
