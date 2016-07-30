import base = require("./propertytree");
import gpatterns = require("../sparql/graphpatterns");
import {
  MappingContract, MappingContractImpl, ScopedMappingContract,
  GraphPatternContract, GraphPatternContractImpl,
} from "./propertytreecontracts";

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
    return base.BranchingArgsGuard.isProperty(args) && args.complex && args.mirroredIdFrom === undefined;
  }

  public create(args: base.BranchingArgs) {
    if (base.BranchingArgsGuard.assertProperty(args))
      return new ComplexBranch(args);
  }
}

export class ComplexBranch extends base.Branch<base.PropertyBranchingArgs> {

  protected applyBranch(args: base.TraversingArgs): base.BranchingResult {
    let basePattern = this.selectPattern(args.get(GraphPatternContract).get());
    let mapping = args.get(MappingContract).getMapping();
    let propertyName = mapping.properties.getNamespacedUriOfProperty(this.branchingArgs.name);
    let variableName = mapping.variables.getComplexProperty(this.branchingArgs.name).getVariable();
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

    let subMapping = mapping.getSubMappingByComplexProperty(this.branchingArgs.name);

    return {
      pattern: subPattern,
      mapping: subMapping,
      scopedMapping: args.get(ScopedMappingContract).getScopedMapping(),
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
    return base.BranchingArgsGuard.isProperty(args)
      && !args.complex && args.singleValued && args.mirroredIdFrom === undefined;
  }

  public create(args: base.BranchingArgs) {
    if (base.BranchingArgsGuard.assertProperty(args))
      return new ElementarySingleValuedBranch(args);
  }
}

export class ElementarySingleValuedBranch extends base.Branch<base.PropertyBranchingArgs> {

  protected applyBranch(args: base.TraversingArgs): base.BranchingResult {
    let basePattern = this.selectPattern(args.get(GraphPatternContract).get());
    let mapping = args.get(MappingContract).getMapping();
    let propertyName = mapping.properties.getNamespacedUriOfProperty(this.branchingArgs.name);
    let variableName = mapping.variables.getElementaryPropertyVariable(this.branchingArgs.name);
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
      scopedMapping: args.get(ScopedMappingContract).getScopedMapping(),
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
    return base.BranchingArgsGuard.isProperty(args)
      && !args.complex && args.mirroredIdFrom !== undefined && args.singleValued && !args.inverse;
  }

  public create(args: base.BranchingArgs) {
    if (base.BranchingArgsGuard.assertProperty(args))
      return new ElementarySingleValuedMirroredBranch(args);
  }
}

export class ElementarySingleValuedMirroredBranch extends base.Branch<base.PropertyBranchingArgs> {

  protected applyBranch(args: base.TraversingArgs): base.BranchingResult {

    let mapping = args.get(MappingContract).getMapping();
    let complexPropertyUri = mapping.properties.getNamespacedUriOfProperty(this.branchingArgs.mirroredIdFrom);
    let idPropertyUri = mapping.getSubMappingByComplexProperty(this.branchingArgs.mirroredIdFrom)
      .properties.getNamespacedUriOfProperty("Id");

    let intermediateVariableName = mapping.variables.getComplexProperty(this.branchingArgs.mirroredIdFrom)
      .getVariable();
    let variableName = mapping.variables.getElementaryPropertyVariable(this.branchingArgs.name);

    let basePattern = this.selectPattern(args.get(GraphPatternContract).get());
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
      scopedMapping: args.get(ScopedMappingContract).getScopedMapping(),
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
    if (base.BranchingArgsGuard.assertInScopeVariable(args))
      return new InScopeVariableBranch(args);
  }
}

export class InScopeVariableBranch extends base.Branch<base.InScopeVariableBranchingArgs> {

  public traverse(args: base.TraversingArgs) {
    let basePattern = this.selectPattern(args.get(GraphPatternContract).get());
    let scopedMapping = args.get(ScopedMappingContract).getScopedMapping();
    let innerPattern = basePattern.looseBranch(
      scopedMapping.getNamespace(this.branchingArgs.name).variables.getVariable());

    let innerPatternSelector = args.get(GraphPatternContract).get().getOtherSelector(innerPattern);
    let innerArgs = args.createChild();
    innerArgs.set(MappingContract,
      new MappingContractImpl(scopedMapping.getNamespace(this.branchingArgs.name)));
    innerArgs.set(GraphPatternContract,
      new GraphPatternContractImpl(innerPatternSelector));
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
    return base.BranchingArgsGuard.isProperty(args)
      && args.complex && args.singleValued && args.mirroredIdFrom === undefined;
  }

  public create(args: base.BranchingArgs) {
    if (base.BranchingArgsGuard.assertProperty(args))
      return new ComplexBranchForFiltering(args);
  }
}

export class ComplexBranchForFiltering extends base.Branch<base.PropertyBranchingArgs> {

  protected applyBranch(args: base.TraversingArgs): base.BranchingResult {
    let basePattern = this.selectPattern(args.get(GraphPatternContract).get());
    let mapping = args.get(MappingContract).getMapping();
    let propertyName = mapping.properties.getNamespacedUriOfProperty(this.branchingArgs.name);
    let variableName = mapping.variables.getComplexProperty(this.branchingArgs.name).getVariable();
    let subPattern: gpatterns.TreeGraphPattern;

    if (this.branchingArgs.inverse === true)
      subPattern = basePattern.optionalInverseBranch(propertyName, variableName);
    else
      subPattern = basePattern.optionalBranch(propertyName, variableName);

    let subMapping = mapping.getSubMappingByComplexProperty(this.branchingArgs.name);

    return {
      pattern: subPattern,
      mapping: subMapping,
      scopedMapping: args.get(ScopedMappingContract).getScopedMapping(),
    };
  }

  private selectPattern(patternSelector: base.GraphPatternSelector) {
    return patternSelector.getRootPattern();
  }
}

// ===

export class ElementaryBranchFactoryForFiltering implements base.TreeFactoryCandidate {
  public doesApply(args: base.BranchingArgs) {
    return base.BranchingArgsGuard.isProperty(args)
      && !args.complex && args.mirroredIdFrom === undefined && args.singleValued;
  }

  public create(args: base.BranchingArgs) {
    if (base.BranchingArgsGuard.assertProperty(args))
      return new ElementaryBranchForFiltering(args);
  }
}

export class ElementaryBranchForFiltering extends base.Branch<base.PropertyBranchingArgs> {

  protected applyBranch(args: base.TraversingArgs): base.BranchingResult {
    let basePattern = this.selectPattern(args.get(GraphPatternContract).get());
    let mapping = args.get(MappingContract).getMapping();
    let propertyName = mapping.properties.getNamespacedUriOfProperty(this.branchingArgs.name);
    let variableName = mapping.variables.getElementaryPropertyVariable(this.branchingArgs.name);
    let subPattern: gpatterns.TreeGraphPattern;

    if (this.branchingArgs.inverse === true)
      subPattern = basePattern.optionalInverseBranch(propertyName, variableName);
    else
      subPattern = basePattern.optionalBranch(propertyName, variableName);

    return {
      pattern: subPattern,
      mapping: undefined,
      scopedMapping: args.get(ScopedMappingContract).getScopedMapping(),
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
    if (base.BranchingArgsGuard.assertAny(args))
      return new AnyBranch(args);
  }
}

export class AnyBranch extends base.Branch<base.AnyBranchingArgs> {

  /**
   * args.mapping should be the last property before the any-ed collection property, say X.
   * args.patternSelector should be based on the branch on top of X.
   */
  protected applyBranch(args: base.TraversingArgs): base.BranchingResult {
    let basePattern = this.selectQueryRootPattern(args);
    let mapping = args.get(MappingContract).getMapping();
    let rootVariableName = mapping.variables.getVariable();
    let collectionPropertyOData = this.branchingArgs.name;
    let collectionPropertyUri = mapping.properties.getNamespacedUriOfProperty(collectionPropertyOData);

    let lambdaExpression = this.branchingArgs.lambdaExpression;
    let innerScopedMapping = args.get(ScopedMappingContract).getScopedMapping().scope(lambdaExpression.scopeId);
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
      mapping: args.get(ScopedMappingContract).getScopedMapping().unscoped(),
      scopedMapping: innerScopedMapping,
      pattern: basePattern,
    };
  }

  private selectQueryRootPattern(args: base.TraversingArgs) {
    let knownPattern = args.get(GraphPatternContract).get().getRootPattern();
    let rootVariable = args.get(ScopedMappingContract).getScopedMapping().unscoped().variables.getVariable();
    return knownPattern.looseBranch(rootVariable);
  }
}
