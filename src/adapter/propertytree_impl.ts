import base = require("./propertytree");
import gpatterns = require("../sparql/graphpatterns");

/**
 * Selects the graph patterns to branch on for those properties which are shown (expanded) in the query result.
 */
export class GraphPatternSelector implements base.GraphPatternSelector {

  private patternForSingleValuedProperties: gpatterns.TreeGraphPattern;

  constructor(private rootPattern: gpatterns.TreeGraphPattern) {
  }

  public getRootPattern() {
    return this.rootPattern;
  }

  public getUnionPatternForSingleValuedBranches() {
    if (this.patternForSingleValuedProperties === undefined) {
      this.patternForSingleValuedProperties = this.createNewUnionPattern();
    }
    return this.patternForSingleValuedProperties;
  }

  public getNewUnionPattern() {
    return this.createNewUnionPattern();
  }

  public getOtherSelector(rootPattern: gpatterns.TreeGraphPattern) {
    return new GraphPatternSelector(rootPattern);
  }

  private createNewUnionPattern() {
    return this.rootPattern.newUnionPattern();
  }
}

// ===

export class ComplexBranchFactory implements base.TreeFactoryCandidate {
  public doesApply(args: base.BranchingArgs) {
    return args.complex && args.mirroredIdFrom === undefined;
  }

  public create(args: base.BranchingArgs) {
    return new ComplexBranch(args);
  }
}

export class ComplexBranch extends base.Branch {

  constructor(branchingArgs: base.BranchingArgs) {
    super(branchingArgs);
  }

  protected applyBranch(args: base.TraversingArgs): base.BranchingResult {
    let basePattern = this.selectPattern(args.patternSelector);
    let propertyName = args.mapping.properties.getNamespacedUriOfProperty(this.branchingArgs.property);
    let variableName = args.mapping.variables.getComplexProperty(this.branchingArgs.property).getVariable();
    let subPattern: gpatterns.TreeGraphPattern;

    if (this.branchingArgs.mandatory === true) {
      if (this.branchingArgs.inverse === true)
        subPattern = basePattern.inverseBranch(propertyName, variableName);
      else
        subPattern = basePattern.branch(propertyName, variableName);
    }
    else {
      if (this.branchingArgs.inverse === true)
        subPattern = basePattern.optionalInverseBranch(propertyName, variableName);
      else
        subPattern = basePattern.optionalBranch(propertyName, variableName);
    }

    let subMapping = args.mapping.getSubMappingByComplexProperty(this.branchingArgs.property);

    return {
      pattern: subPattern,
      mapping: subMapping,
      scopedMapping: args.scopedMapping,
    };
  }

  private selectPattern(patternSelector: base.GraphPatternSelector) {
    if (this.branchingArgs.singleValued)
      return patternSelector.getUnionPatternForSingleValuedBranches();
    else
      return patternSelector.getNewUnionPattern();
  }
}

// ===

export class ElementarySingleValuedBranchFactory implements base.TreeFactoryCandidate {
  public doesApply(args: base.BranchingArgs) {
    return !args.complex && args.mirroredIdFrom === undefined && args.singleValued;
  }

  public create(args: base.BranchingArgs) {
    return new ElementarySingleValuedBranch(args);
  }
}

export class ElementarySingleValuedBranch extends base.Branch {

  constructor(branchingArgs: base.BranchingArgs) {
    super(branchingArgs);
  }

  protected applyBranch(args: base.TraversingArgs): base.BranchingResult {
    let basePattern = this.selectPattern(args.patternSelector);
    let propertyName = args.mapping.properties.getNamespacedUriOfProperty(this.branchingArgs.property);
    let variableName = args.mapping.variables.getElementaryPropertyVariable(this.branchingArgs.property);
    let subPattern: gpatterns.TreeGraphPattern;

    if (this.branchingArgs.mandatory === true) {
      if (this.branchingArgs.inverse === true)
        subPattern = basePattern.inverseBranch(propertyName, variableName);
      else
        subPattern = basePattern.branch(propertyName, variableName);
    }
    else {
      if (this.branchingArgs.inverse === true)
        subPattern = basePattern.optionalInverseBranch(propertyName, variableName);
      else
        subPattern = basePattern.optionalBranch(propertyName, variableName);
    }

    return {
      pattern: subPattern,
      mapping: undefined,
      scopedMapping: args.scopedMapping,
    };
  }

  private selectPattern(patternSelector: base.GraphPatternSelector) {
    if (this.branchingArgs.property === "Id")
      return patternSelector.getRootPattern();
    else
      return patternSelector.getUnionPatternForSingleValuedBranches();
  }
}

// ===

export class ElementarySingleValuedMirroredBranchFactory implements base.TreeFactoryCandidate {
  public doesApply(args: base.BranchingArgs) {
    return !args.complex && args.mirroredIdFrom !== undefined && args.singleValued && !args.inverse;
  }

  public create(args: base.BranchingArgs) {
    return new ElementarySingleValuedMirroredBranch(args);
  }
}

export class ElementarySingleValuedMirroredBranch extends base.Branch {

  constructor(branchingArgs: base.BranchingArgs) {
    super(branchingArgs);
  }

  protected applyBranch(args: base.TraversingArgs): base.BranchingResult {

    let complexPropertyUri = args.mapping.properties.getNamespacedUriOfProperty(this.branchingArgs.mirroredIdFrom);
    let idPropertyUri = args.mapping.getSubMappingByComplexProperty(this.branchingArgs.mirroredIdFrom)
      .properties.getNamespacedUriOfProperty("Id");

    let intermediateVariableName = args.mapping.variables.getComplexProperty(this.branchingArgs.mirroredIdFrom)
      .getVariable();
    let variableName = args.mapping.variables.getElementaryPropertyVariable(this.branchingArgs.property);

    let basePattern = this.selectPattern(args.patternSelector);
    let subPattern = this.branchingArgs.mandatory === true ?
      basePattern
        .branch(complexPropertyUri, intermediateVariableName)
        .branch(idPropertyUri, variableName) :
      basePattern
        .optionalBranch(complexPropertyUri, intermediateVariableName)
        .branch(idPropertyUri, variableName);

    return {
      pattern: subPattern,
      mapping: undefined,
      scopedMapping: args.scopedMapping,
    };
  }

  private selectPattern(patternSelector: base.GraphPatternSelector) {
    return patternSelector.getUnionPatternForSingleValuedBranches();
  }
}

// ===

export class InScopeVariableBranchFactory implements base.TreeFactoryCandidate {

  public doesApply(args: base.BranchingArgs) {
    return args.inScopeVariable;
  }

  public create(args: base.BranchingArgs) {
    return new InScopeVariableBranch(args);
  }
}

export class InScopeVariableBranch extends base.Branch {

  public traverse(args: base.TraversingArgs) {
    let basePattern = this.selectPattern(args.patternSelector);
    let innerPattern = basePattern.looseBranch(
      args.mapping.variables.getLambdaNamespace(this.branchingArgs.property).getVariable());

    let innerPatternSelector = args.patternSelector.getOtherSelector(innerPattern);
    let innerArgs: base.TraversingArgs = {
      mapping: args.mapping.getSubMappingByLambdaVariable(this.branchingArgs.property,
                                                          this.branchingArgs.inScopeVariableType),
      scopedMapping: args.scopedMapping,
      patternSelector: innerPatternSelector,
    };
    this.branches.forEach(branch => {
      branch.traverse(innerArgs);
    });
  }

  private selectPattern(patternSelector: base.GraphPatternSelector) {
    return patternSelector.getRootPattern();
  }
}

// ===

export class ComplexBranchFactoryForFiltering implements base.TreeFactoryCandidate {
  public doesApply(args: base.BranchingArgs) {
    return args.complex && args.singleValued && args.mirroredIdFrom === undefined && !args.inScopeVariable;
  }

  public create(args: base.BranchingArgs) {
    return new ComplexBranchForFiltering(args);
  }
}

export class ComplexBranchForFiltering extends base.Branch {

  constructor(branchingArgs: base.BranchingArgs) {
    super(branchingArgs);
  }

  protected applyBranch(args: base.TraversingArgs): base.BranchingResult {
    let basePattern = this.selectPattern(args.patternSelector);
    let propertyName = args.mapping.properties.getNamespacedUriOfProperty(this.branchingArgs.property);
    let variableName = args.mapping.variables.getComplexProperty(this.branchingArgs.property).getVariable();
    let subPattern: gpatterns.TreeGraphPattern;

    if (this.branchingArgs.inverse === true)
      subPattern = basePattern.optionalInverseBranch(propertyName, variableName);
    else
      subPattern = basePattern.optionalBranch(propertyName, variableName);

    let subMapping = args.mapping.getSubMappingByComplexProperty(this.branchingArgs.property);

    return {
      pattern: subPattern,
      mapping: subMapping,
      scopedMapping: args.scopedMapping,
    };
  }

  private selectPattern(patternSelector: base.GraphPatternSelector) {
    return patternSelector.getRootPattern();
  }
}

// ===

export class ElementaryBranchFactoryForFiltering implements base.TreeFactoryCandidate {
  public doesApply(args: base.BranchingArgs) {
    return !args.complex && args.mirroredIdFrom === undefined && args.singleValued && !args.inScopeVariable;
  }

  public create(args: base.BranchingArgs) {
    return new ElementaryBranchForFiltering(args);
  }
}

export class ElementaryBranchForFiltering extends base.Branch {

  constructor(branchingArgs: base.BranchingArgs) {
    super(branchingArgs);
  }

  protected applyBranch(args: base.TraversingArgs): base.BranchingResult {
    let basePattern = this.selectPattern(args.patternSelector);
    let propertyName = args.mapping.properties.getNamespacedUriOfProperty(this.branchingArgs.property);
    let variableName = args.mapping.variables.getElementaryPropertyVariable(this.branchingArgs.property);
    let subPattern: gpatterns.TreeGraphPattern;

    if (this.branchingArgs.inverse === true)
      subPattern = basePattern.optionalInverseBranch(propertyName, variableName);
    else
      subPattern = basePattern.optionalBranch(propertyName, variableName);

    return {
      pattern: subPattern,
      mapping: undefined,
      scopedMapping: args.scopedMapping,
    };
  }

  private selectPattern(patternSelector: base.GraphPatternSelector) {
    return patternSelector.getRootPattern();
  }
}
