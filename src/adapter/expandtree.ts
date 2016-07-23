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
export class DirectPropertiesGraphPatternFactory {

  public static create(entityType: schema.EntityType, branchFactory: propertyTree.BranchFactory,
                       options: string): propertyTree.Tree {

    let tree = new propertyTree.RootTree();

    let propertyNames = entityType.getPropertyNames();
    let properties = propertyNames.map(p => entityType.getProperty(p));

    for (let i = 0; i < properties.length; ++i) {
      let property = properties[i];
      let propertyName = property.getName();
      if (propertyName === "Id" && options.indexOf("no-id-property") >= 0) continue;
      /*if (property.isNavigationProperty() === false) {
        new ElementaryBranchInsertionBuilder()
          .setMapping(mapping)
          .setElementaryProperty(property)
          .buildCommand()
          .applyTo(rootPattern);
      }*/
      if (property.getEntityKind() === schema.EntityKind.Elementary) {
        let args: propertyTree.BranchingArgs = {
          property: property.getName(),
          inverse: !property.mirroredFromProperty() && !property.hasDirectRdfRepresentation(),
          mandatory: !property.isOptional(),
          singleValued: property.isCardinalityOne(),
          complex: false,
          mirroredIdFrom: property.mirroredFromProperty() && property.mirroredFromProperty().getName(),
        };
        tree.branch(branchFactory.create(args));
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

  public static create(entityType: schema.EntityType, expandTree, mapping: mappings.IStructuredSparqlVariableMapping) {
    let branchFactory = new propertyTree.TreeDependencyInjector()
      .registerFactoryCandidates(
        new propertyTreeImpl.ElementarySingleValuedBranchFactory(),
        new propertyTreeImpl.ElementarySingleValuedMirroredBranchFactory(),
        new propertyTreeImpl.ComplexBranchFactory()
      );
    let tree = this.createTree(entityType, expandTree, branchFactory);
    let result = new gpatterns.TreeGraphPattern(mapping.getVariable());
    tree.traverse({
      patternSelector: new propertyTreeImpl.GraphPatternSelectorForExpandedProperties(result),
      mapping: new mappings.Mapping(
        new mappings.PropertyMapping(entityType),
        mapping
      ),
    });
    return result;
  }

  private static createTree(entityType: schema.EntityType, expandTree, branchFactory: propertyTree.BranchFactory) {

    let tree = new propertyTree.RootTree();

    tree.branch(branchFactory.create({
      property: "Id",
      inverse: false,
      complex: false,
      mirroredIdFrom: undefined,
      singleValued: true,
      mandatory: true,
    }));

    let directPropertyTree = DirectPropertiesGraphPatternFactory.create(entityType, branchFactory, "no-id-property");
    directPropertyTree.copyTo(tree);

    Object.keys(expandTree).forEach(propertyName => {
      let property = entityType.getProperty(propertyName);

      let branch = tree.branch(branchFactory.create({
        property: property.getName(),
        mirroredIdFrom: undefined,
        complex: true,
        mandatory: !property.isOptional(),
        singleValued: property.isCardinalityOne(),
        inverse: !property.hasDirectRdfRepresentation(),
      }));

      let recursive = ExpandTreeGraphPatternFactory.createTree(property.getEntityType(), expandTree[propertyName],
        branchFactory);
      recursive.copyTo(branch);

      /*new ComplexBranchInsertionBuilder()
        .setComplexProperty(property)
        .setValue(branch)
        .setMapping(mapping)
        .buildCommand()
        .applyTo(baseGraphPattern);*/
    });

    return tree;
  }
}

/*export class ComplexBranchInsertionBuilder extends gpatternInsertions.AbstractComplexBranchInsertionBuilder {

  public buildCommandNoValidityChecks(): gpatternInsertions.BranchInsertionCommand {
    if (this.property.hasDirectRdfRepresentation()) {
      return new gpatternInsertions.NormalBranchInsertionCommand()
        .branch(this.property.getNamespacedUri(), this.value);
    }
    else {
      let inverseProperty = this.property.getInverseProperty();
      return new gpatternInsertions.InverseBranchInsertionCommand()
        .branch(inverseProperty.getNamespacedUri(), this.value);
    }
  }
}

export class ElementaryBranchInsertionBuilder extends gpatternInsertions.AbstractElementaryBranchInsertionBuilder {

  protected buildCommandNoValidityChecks(): gpatternInsertions.BranchInsertionCommand {
    if (this.property.mirroredFromProperty()) {
      return this.buildMirroringPropertyNoValidityChecks();
    }
    else {
      return this.buildNotMirroringPropertyNoValidityChecks();
    }
  }

  private buildMirroringPropertyNoValidityChecks() {
    let mirroringProperty = this.property.mirroredFromProperty();
    let mirroringPropertyVariable = this.mapping.getComplexProperty(mirroringProperty.getName()).getVariable();

    let insertionCommand = this.createMandatoryOrOptionalCommand(mirroringProperty);
    insertionCommand
      .branch(mirroringProperty.getNamespacedUri(), mirroringPropertyVariable)
      .branch("disco:id", this.mapping.getElementaryPropertyVariable(this.property.getName()));
    return insertionCommand;
  }

  private buildNotMirroringPropertyNoValidityChecks() {
    let insertionCommand = this.createMandatoryOrOptionalCommand(this.property);
    insertionCommand
      .branch(this.property.getNamespacedUri(), this.mapping.getElementaryPropertyVariable(this.property.getName()));
    return insertionCommand;
  }

  private createMandatoryOrOptionalCommand(property: schema.Property): gpatternInsertions.BranchInsertionCommand {
    return property.isOptional() ?
      new gpatternInsertions.OptionalBranchInsertionCommand() : new gpatternInsertions.NormalBranchInsertionCommand();
  }
}*/
