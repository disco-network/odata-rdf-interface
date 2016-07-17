import gpatterns = require("../odata/graphpatterns");
import gpatternInsertions = require("./graphpatterninsertions");
import mappings = require("./mappings");
import schema = require("../odata/schema");

/**
 * Creates a SPARQL graph pattern involving all direct and elementary
 * properties belonging to the OData entity type passed as schema.
 * Please separate the options like this: "no-id-property|some-other-option"
 */
export class DirectPropertiesGraphPatternFactory {

  public static create(entityType: schema.EntityType,
                       mapping: mappings.StructuredSparqlVariableMapping, options: string): gpatterns.TreeGraphPattern {
    let result = new gpatterns.TreeGraphPattern(mapping.getVariable());

    let propertyNames = entityType.getPropertyNames();
    let properties = propertyNames.map(p => entityType.getProperty(p));

    for (let i = 0; i < properties.length; ++i) {
      let property = properties[i];
      let propertyName = property.getName();
      if (propertyName === "Id" && options.indexOf("no-id-property") >= 0) continue;
      if (property.isNavigationProperty() === false) {
        new ElementaryBranchInsertionBuilder()
          .setMapping(mapping)
          .setElementaryProperty(property)
          .buildCommand()
          .applyTo(result);
      }
    }

    return result;
  }
}

/**
 * Creates a SPARQL graph pattern depending an entity type schema, an expand tree
 * (only considering complex properties) and a StructuredSparqlVariableMapping
 * so that it contains all data necessary for an OData $expand query.
 */
export class ExpandTreeGraphPatternFactory {

  public static create(entityType: schema.EntityType, expandTree, mapping: mappings.StructuredSparqlVariableMapping) {
    let result = new gpatterns.TreeGraphPattern(mapping.getVariable());

    result.branch(entityType.getProperty("Id").getNamespacedUri(), mapping.getElementaryPropertyVariable("Id"));

    let directPropertyPattern = DirectPropertiesGraphPatternFactory.create(entityType, mapping, "no-id-property");
    result.newUnionPattern(directPropertyPattern);
    Object.keys(expandTree).forEach(propertyName => {
      let property = entityType.getProperty(propertyName);
      let baseGraphPattern = result.newUnionPattern();
      let branch = ExpandTreeGraphPatternFactory.create(property.getEntityType(), expandTree[propertyName],
        mapping.getComplexProperty(propertyName));

      new ComplexBranchInsertionBuilder()
        .setComplexProperty(property)
        .setValue(branch)
        .setMapping(mapping)
        .buildCommand()
        .applyTo(baseGraphPattern);
    });

    return result;
  }
}

export class ComplexBranchInsertionBuilder extends gpatternInsertions.AbstractComplexBranchInsertionBuilder {

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
}
