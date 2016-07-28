import gpatterns = require("../sparql/graphpatterns");
import mappings = require("./mappings");
import schema = require("../odata/schema");
import propertyTree = require("./propertytree");
import propertyTreeImpl = require("./propertytree_impl");

/**
 * Creates a SPARQL graph pattern involving all direct and elementary
 * properties belonging to the OData entity type passed as schema.
 * Please separate the options like this: "no-id-property|some-other-option"
 */
export class DirectPropertiesTreeStrategy {

  constructor(private branchFactory: propertyTree.BranchFactory) {}

  public create(entityType: schema.EntityType, options: string): propertyTree.Tree {

    let tree = new propertyTree.RootTree();

    let propertyNames = entityType.getPropertyNames();
    let properties = propertyNames.map(p => entityType.getProperty(p));

    for (let i = 0; i < properties.length; ++i) {
      let property = properties[i];
      let propertyName = property.getName();
      if (propertyName === "Id" && options.indexOf("no-id-property") >= 0) continue;
      if (property.getEntityKind() === schema.EntityKind.Elementary) {
        let args = new propertyTree.PropertyBranchingArgsBuilder()
          .name(property.getName())
          .inverse(!property.mirroredFromProperty() && !property.hasDirectRdfRepresentation())
          .mandatory(!property.isOptional())
          .singleValued(property.isCardinalityOne())
          .complex(false)
          .mirroredIdFrom(property.mirroredFromProperty() && property.mirroredFromProperty().getName())
          .loose(false)
          .value;
        tree.branch(this.branchFactory.create(args));
      }
    }

    return tree;
  }
}

/**
 * Creates a SPARQL graph pattern depending an entity type schema, an expand tree
 * (only considering complex properties) and a StructuredSparqlVariableMapping
 * so that it contains all data necessary for an OData $expand query.
 */
export class ExpandTreeGraphPatternFactory {

  private directPropertiesStrategy: DirectPropertiesTreeStrategy;

  constructor(private branchFactory: propertyTree.BranchFactory) {
    this.directPropertiesStrategy = new DirectPropertiesTreeStrategy(this.branchFactory);
  }

  public create(entityType: schema.EntityType, expandTree,
                variableMapping: mappings.IStructuredSparqlVariableMapping) {
    let tree = this.createTree(entityType, expandTree);
    let result = new gpatterns.TreeGraphPattern(variableMapping.getVariable());
    let mapping = new mappings.Mapping(
      new mappings.PropertyMapping(entityType),
      variableMapping
    );
    tree.traverse({
      patternSelector: /* @smell */ new propertyTreeImpl.GraphPatternSelector(result),
      mapping: mapping,
      scopedMapping: new mappings.ScopedMapping(mapping),
    });
    return result;
  }

  private createTree(entityType: schema.EntityType, expandTree) {

    let tree = new propertyTree.RootTree();

    tree.branch(this.branchFactory.create(new propertyTree.PropertyBranchingArgsBuilder()
      .name("Id")
      .inverse(false)
      .complex(false)
      .mirroredIdFrom(undefined)
      .singleValued(true)
      .mandatory(true)
      .loose(false)
      .value));

    let directPropertyTree = this.directPropertiesStrategy.create(entityType, "no-id-property");
    directPropertyTree.copyTo(tree);

    for (let propertyName of Object.keys(expandTree)) {
      let property = entityType.getProperty(propertyName);

      let branch = tree.branch(this.branchFactory.create(new propertyTree.PropertyBranchingArgsBuilder()
        .name(property.getName())
        .mirroredIdFrom(undefined)
        .complex(true)
        .mandatory(!property.isOptional())
        .singleValued(property.isCardinalityOne())
        .inverse(!property.hasDirectRdfRepresentation())
        .loose(false).value));

      let recursive = this.createTree(property.getEntityType(), expandTree[propertyName]);
      recursive.copyTo(branch);
    }

    return tree;
  }
}
