var queryFactory = require('../querycomposer');

describe("query composer", function() {
  it("should create an expand tree", function() {
      var expandOption = [ { path: [ "A", "B", "C" ] }, { path: [ "A", "B", "D" ] }, { path: [ "A", "C" ] } ];
      var composer = new queryFactory.QueryComposer('MyEntitySet', { entitySets: { 'MyEntitySet': {} } });
      composer.expand(expandOption);

      expect('composer.expandTree.A.B.C').toBeDefined()
      expect('composer.expandTree.A.B.D').toBeDefined()
      expect('composer.expandTree.A.C').toBeDefined()
  })
})
