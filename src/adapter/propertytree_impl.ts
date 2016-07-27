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
    return args.type === "property" && args.complex && args.mirroredIdFrom === undefined;
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
    let propertyName = args.mapping.properties.getNamespacedUriOfProperty(this.branchingArgs.name);
    let variableName = args.mapping.variables.getComplexProperty(this.branchingArgs.name).getVariable();
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

    let subMapping = args.mapping.getSubMappingByComplexProperty(this.branchingArgs.name);

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
    return args.type === "property" && !args.complex && args.mirroredIdFrom === undefined && args.singleValued;
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
    let propertyName = args.mapping.properties.getNamespacedUriOfProperty(this.branchingArgs.name);
    let variableName = args.mapping.variables.getElementaryPropertyVariable(this.branchingArgs.name);
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
    if (this.branchingArgs.name === "Id")
      return patternSelector.getRootPattern();
    else
      return patternSelector.getUnionPatternForSingleValuedBranches();
  }
}

// ===

export class ElementarySingleValuedMirroredBranchFactory implements base.TreeFactoryCandidate {
  public doesApply(args: base.BranchingArgs) {
    return args.type === "property" && !args.complex && args.mirroredIdFrom !== undefined && args.singleValued &&
      !args.inverse;
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
    let variableName = args.mapping.variables.getElementaryPropertyVariable(this.branchingArgs.name);

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
    return args.type === "inScopeVariable";
  }

  public create(args: base.BranchingArgs) {
    return new InScopeVariableBranch(args);
  }
}

export class InScopeVariableBranch extends base.Branch {

  public traverse(args: base.TraversingArgs) {
    let basePattern = this.selectPattern(args.patternSelector);
    let innerPattern = basePattern.looseBranch(
      args.scopedMapping.getNamespace(this.branchingArgs.name).variables.getVariable());

    let innerPatternSelector = args.patternSelector.getOtherSelector(innerPattern);
    let innerArgs: base.TraversingArgs = {
      mapping: args.scopedMapping.getNamespace(this.branchingArgs.name),
      scopedMapping: args.scopedMapping,
      patternSelector: innerPatternSelector,
    };
    for (let key of Object.keys(this.branches)) {
      this.branches[key].traverse(innerArgs);
    }
  }

  private selectPattern(patternSelector: base.GraphPatternSelector) {
    return patternSelector.getRootPattern();
  }
}

// ===

export class ComplexBranchFactoryForFiltering implements base.TreeFactoryCandidate {
  public doesApply(args: base.BranchingArgs) {
    return args.type === "property" && args.complex && args.singleValued && args.mirroredIdFrom === undefined;
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
    let propertyName = args.mapping.properties.getNamespacedUriOfProperty(this.branchingArgs.name);
    let variableName = args.mapping.variables.getComplexProperty(this.branchingArgs.name).getVariable();
    let subPattern: gpatterns.TreeGraphPattern;

    if (this.branchingArgs.inverse === true)
      subPattern = basePattern.optionalInverseBranch(propertyName, variableName);
    else
      subPattern = basePattern.optionalBranch(propertyName, variableName);

    let subMapping = args.mapping.getSubMappingByComplexProperty(this.branchingArgs.name);

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
    return args.type === "property" && !args.complex && args.mirroredIdFrom === undefined && args.singleValued;
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
    let propertyName = args.mapping.properties.getNamespacedUriOfProperty(this.branchingArgs.name);
    let variableName = args.mapping.variables.getElementaryPropertyVariable(this.branchingArgs.name);
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

// ===

export class AnyBranchFactory implements base.TreeFactoryCandidate {
  public doesApply(args: base.BranchingArgs) {
    return args.type === "any";
  }

  public create(args: base.BranchingArgs) {
    return new AnyBranch(args);
  }
}

export class AnyBranch extends base.Branch {

  constructor(branchingArgs: base.BranchingArgs) {
    super(branchingArgs);
  }

  /**
   * args.mapping should be the last property before the any-ed collection property, say X.
   * args.patternSelector should be based on the branch on top of X.
   */
  protected applyBranch(args: base.TraversingArgs): base.BranchingResult {
    let basePattern = this.selectQueryRootPattern(args);
    let rootVariableName = args.mapping.variables.getVariable();
    let collectionPropertyOData = this.branchingArgs.name;
    let collectionPropertyUri = args.mapping.properties.getNamespacedUriOfProperty(collectionPropertyOData);

    let lambdaExpression = this.branchingArgs.lambdaExpression;
    let innerScopedMapping = args.scopedMapping.scope(lambdaExpression.scopeId);
    innerScopedMapping.setNamespace(lambdaExpression.variable, lambdaExpression.entityType);
    let lambdaVariableName = innerScopedMapping.getNamespace(lambdaExpression.variable).variables.getVariable();

    if (this.branchingArgs.inverse) {
      basePattern
        .looseBranch(rootVariableName)
        .optionalInverseBranch(collectionPropertyUri, lambdaVariableName);
    }
    else {
      basePattern
        .looseBranch(rootVariableName)
        .optionalBranch(collectionPropertyUri, lambdaVariableName);
    }

    return {
      mapping: args.scopedMapping.unscoped(),
      scopedMapping: innerScopedMapping,
      pattern: basePattern,
    };
  }

  private selectQueryRootPattern(args: base.TraversingArgs) {
    let knownPattern = args.patternSelector.getRootPattern();
    let rootVariable = args.scopedMapping.unscoped().variables.getVariable();
    return knownPattern.looseBranch(rootVariable);
  }
}
