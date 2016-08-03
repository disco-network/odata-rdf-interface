import SchemaModule = require("../src/odata/schema");
let schema = new SchemaModule.Schema();
import expandTreePatterns = require("../src/adapter/expandtree");
import mhelper = require("./helpers/sparql_mappings");
import propertyTrees = require("../src/adapter/propertytree/propertytree");
import propertyTreesImpl = require("../src/adapter/propertytree/propertytree_impl");

describe('OData properties with quantity "many"', function() {
  it("should be integrated with UNION", function() {
    let expandTree = { Children: {} };
    let mapping = mhelper.createStructuredMapping("?post");
    let expandPatternFactory = new expandTreePatterns.ExpandTreeGraphPatternFactory(createBranchFactory());
    let gp = expandPatternFactory.create(schema.getEntityType("Post"),
      expandTree, mapping);

    expect(gp.getUnionPatterns().length).toEqual(2);
    expect(gp.getUnionPatterns()[1].inverseBranch("disco:parent").length).toEqual(1);
  });
});

function createBranchFactory() {
  return new propertyTrees.TreeDependencyInjector()
    .registerFactoryCandidates(
      new propertyTreesImpl.ElementarySingleValuedBranchFactory(),
      new propertyTreesImpl.ElementarySingleValuedMirroredBranchFactory(),
      new propertyTreesImpl.ComplexBranchFactory()
    );
}
