import gpatterns = require("../odata/graphpatterns");
import schema = require("../odata/schema");
import mappings = require("./mappings");

export class AbstractBranchInsertionBuilder {

  protected mapping: mappings.StructuredSparqlVariableMapping;

  public buildCommand(): BranchInsertionCommand {
    if (this.validateParameters()) {
      return this.buildCommandNoValidityChecks();
    }
    else throw new Error("Don't forget to set property and mapping before building the branch insertion command!");
  }

  public setMapping(mapping: mappings.StructuredSparqlVariableMapping) {
    this.mapping = mapping;
    return this;
  }

  protected validateParameters() {
    return this.mapping !== undefined;
  }

  protected buildCommandNoValidityChecks(): BranchInsertionCommand {
    throw new Error("abstract method; not implemented");
  }
}

export class AbstractComplexBranchInsertionBuilder extends AbstractBranchInsertionBuilder {

  protected property: schema.Property;
  protected value: gpatterns.TreeGraphPattern;

  public setComplexProperty(property: schema.Property) {
    if (property.getEntityKind() === schema.EntityKind.Complex) {
      this.property = property;
      return this;
    }
    else
      throw new Error("property should be complex");
  }

  public setValue(value: gpatterns.TreeGraphPattern) {
    this.value = value;
    return this;
  }

  public validateParameters(): boolean {
    return super.validateParameters() && this.property !== undefined && this.value !== undefined;
  }
}

export class AbstractElementaryBranchInsertionBuilder extends AbstractBranchInsertionBuilder {

  protected property: schema.Property;

  public setElementaryProperty(property: schema.Property) {
    if (property.getEntityKind() === schema.EntityKind.Elementary)
      this.property = property;
    else throw new Error("property should be elementary");
    return this;
  }

  protected validateParameters(): boolean {
    return super.validateParameters() && this.property !== undefined;
  }
}

export class ComplexBranchInsertionBuilderForFiltering extends AbstractComplexBranchInsertionBuilder {

  public buildCommandNoValidityChecks(): BranchInsertionCommand {
    if (this.property.hasDirectRdfRepresentation()) {
      return new OptionalBranchInsertionCommand()
        .branch(this.property.getNamespacedUri(), this.value);
    }
    else {
      let inverseProperty = this.property.getInverseProperty();
      return new OptionalInverseBranchInsertionCommand()
        .branch(inverseProperty.getNamespacedUri(), this.value);
    }
  }
}

export class ElementaryBranchInsertionBuilderForFiltering extends AbstractElementaryBranchInsertionBuilder {

  protected buildCommandNoValidityChecks(): BranchInsertionCommand {
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

    let insertionCommand = this.createCommand(mirroringProperty);
    insertionCommand
      .branch(mirroringProperty.getNamespacedUri(), mirroringPropertyVariable)
      .branch("disco:id", this.mapping.getElementaryPropertyVariable(this.property.getName()));
    return insertionCommand;
  }

  private buildNotMirroringPropertyNoValidityChecks() {
    let insertionCommand = this.createCommand(this.property);
    insertionCommand
      .branch(this.property.getNamespacedUri(), this.mapping.getElementaryPropertyVariable(this.property.getName()));
    return insertionCommand;
  }

  private createCommand(property: schema.Property): BranchInsertionCommand {
    return new OptionalBranchInsertionCommand();
  }
}

export interface BranchInsertionCommand {
  branch(property: string, value: string | gpatterns.TreeGraphPattern): BranchInsertionCommand;
  applyTo(graphPattern: gpatterns.TreeGraphPattern): gpatterns.TreeGraphPattern;
}

export class NormalBranchInsertionCommand implements BranchInsertionCommand {
  private branchingChain: { property: string; value: string | gpatterns.TreeGraphPattern }[] = [];

  public branch(property: string, value: string | gpatterns.TreeGraphPattern) {
    this.branchingChain.push({ property: property, value: value });
    return this;
  }

  public applyTo(graphPattern: gpatterns.TreeGraphPattern) {
    let currentBranch = graphPattern;
    for (let i = 0; i < this.branchingChain.length; ++i) {
      let step = this.branchingChain[i];
      currentBranch = currentBranch.branch(step.property, step.value);
    }
    return currentBranch;
  }
}

export class InverseBranchInsertionCommand implements BranchInsertionCommand {
  private branchingChain: { property: string; value: string | gpatterns.TreeGraphPattern }[] = [];

  public branch(property: string, value: string | gpatterns.TreeGraphPattern) {
    this.branchingChain.push({ property: property, value: value });
    return this;
  }

  public applyTo(graphPattern: gpatterns.TreeGraphPattern) {
    let currentBranch = graphPattern;
    for (let i = 0; i < this.branchingChain.length; ++i) {
      let step = this.branchingChain[i];
      currentBranch = currentBranch.inverseBranch(step.property, step.value);
    }
    return currentBranch;
  }
}

export class OptionalBranchInsertionCommand implements BranchInsertionCommand {
  private branchingChain: { property: string; value: string | gpatterns.TreeGraphPattern }[] = [];

  public branch(property: string, value: string | gpatterns.TreeGraphPattern) {
    this.branchingChain.push({ property: property, value: value });
    return this;
  }

  public applyTo(graphPattern: gpatterns.TreeGraphPattern) {
    let currentBranch = graphPattern;
    for (let i = 0; i < this.branchingChain.length; ++i) {
      let step = this.branchingChain[i];
      if (i === 0) {
        currentBranch = currentBranch.optionalBranch(step.property, step.value);
      }
      else {
        currentBranch = currentBranch.branch(step.property, step.value);
      }
    }
    return currentBranch;
  }
}

export class OptionalInverseBranchInsertionCommand implements BranchInsertionCommand {
  private branchingChain: { property: string; value: string | gpatterns.TreeGraphPattern }[] = [];

  public branch(property: string, value: string | gpatterns.TreeGraphPattern) {
    this.branchingChain.push({ property: property, value: value });
    return this;
  }

  public applyTo(graphPattern: gpatterns.TreeGraphPattern) {
    let currentBranch = graphPattern;
    for (let i = 0; i < this.branchingChain.length; ++i) {
      let step = this.branchingChain[i];
      if (i === 0) {
        currentBranch = currentBranch.optionalInverseBranch(step.property, step.value);
      }
      else {
        throw new Error("cannot chain optional inverse branches");
      }
    }
    return currentBranch;
  }
}
