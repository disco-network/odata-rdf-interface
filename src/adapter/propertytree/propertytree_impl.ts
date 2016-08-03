import base = require("./propertytree");
import gpatterns = require("../../sparql/graphpatterns");
import {
  ITraversingArgs, IGraphPatterngArgs, IMappingArgs, IScopedMappingArgs, IGraphPatternSelector,
} from "./traversingargs";

/**
 * Selects the graph patterns to branch on for those properties which are shown (expanded) in the query result.
 */
export class GraphPatternSelector implements IGraphPatternSelector {

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

  protected applyBranch(args: IGraphPatterngArgs & IMappingArgs): ITraversingArgs {
    let basePattern = this.selectPattern(args.patternSelector);
    let mapping = args.mapping;
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

    let result = args.clone();
    result.mapping = subMapping;
    result.patternSelector = args.patternSelector.getOtherSelector(subPattern);
    return result;
  }

  private selectPattern(patternSelector: IGraphPatternSelector) {
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

  protected applyBranch(args: IGraphPatterngArgs & IMappingArgs): ITraversingArgs {
    let basePattern = this.selectPattern(args.patternSelector);
    let mapping = args.mapping;
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

    let result = args.clone();
    result.patternSelector = args.patternSelector.getOtherSelector(subPattern);
    result.mapping = undefined;
    return result;
  }

  private selectPattern(patternSelector: IGraphPatternSelector) {
    if (this.branchingArgs.name === "Id")
      return patternSelector.getRootPattern();
    else
      return patternSelector.getUnionPatternForSingleValuedBranches();
  }
}

// ===

/* @smell always having to check that mirroredIdFrom !== undefined violates OCP */
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

  protected applyBranch(args: IGraphPatterngArgs & IMappingArgs): ITraversingArgs {

    let mapping = args.mapping;
    let complexPropertyUri = mapping.properties.getNamespacedUriOfProperty(this.branchingArgs.mirroredIdFrom);
    let idPropertyUri = mapping.getSubMappingByComplexProperty(this.branchingArgs.mirroredIdFrom)
      .properties.getNamespacedUriOfProperty("Id");

    let intermediateVariableName = mapping.variables.getComplexProperty(this.branchingArgs.mirroredIdFrom)
      .getVariable();
    let variableName = mapping.variables.getElementaryPropertyVariable(this.branchingArgs.name);

    let basePattern = this.selectPattern(args.patternSelector);
    let subPattern = this.branchingArgs.mandatory === true ?
      basePattern
        .branch(complexPropertyUri, intermediateVariableName)
        .branch(idPropertyUri, variableName) :
      basePattern
        .optionalBranch(complexPropertyUri, intermediateVariableName)
        .branch(idPropertyUri, variableName);

    let result = args.clone();
    result.patternSelector = args.patternSelector.getOtherSelector(subPattern);
    result.mapping = undefined;
    return result;
  }

  private selectPattern(patternSelector: IGraphPatternSelector) {
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

  public traverse(args: ITraversingArgs) {
    let basePattern = this.selectPattern(args.patternSelector);
    let scopedMapping = args.scopedMapping;
    let innerPattern = basePattern.looseBranch(
      scopedMapping.getNamespace(this.branchingArgs.name).variables.getVariable());

    let innerPatternSelector = args.patternSelector.getOtherSelector(innerPattern);
    let innerArgs = args.clone();
    innerArgs.mapping = scopedMapping.getNamespace(this.branchingArgs.name);
    innerArgs.patternSelector = innerPatternSelector;
    for (let key of Object.keys(this.branches)) {
      this.branches[key].traverse(innerArgs);
    }
  }

  private selectPattern(patternSelector: IGraphPatternSelector) {
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

  protected applyBranch(args: IGraphPatterngArgs & IMappingArgs): ITraversingArgs {
    let basePattern = this.selectPattern(args.patternSelector);
    let mapping = args.mapping;
    let propertyName = mapping.properties.getNamespacedUriOfProperty(this.branchingArgs.name);
    let variableName = mapping.variables.getComplexProperty(this.branchingArgs.name).getVariable();
    let subPattern: gpatterns.TreeGraphPattern;

    if (this.branchingArgs.inverse === true)
      subPattern = basePattern.optionalInverseBranch(propertyName, variableName);
    else
      subPattern = basePattern.optionalBranch(propertyName, variableName);

    let subMapping = mapping.getSubMappingByComplexProperty(this.branchingArgs.name);

    let result = args.clone();
    result.patternSelector = args.patternSelector.getOtherSelector(subPattern);
    result.mapping = subMapping;
    return result;
  }

  private selectPattern(patternSelector: IGraphPatternSelector) {
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

  protected applyBranch(args: IGraphPatterngArgs & IMappingArgs): ITraversingArgs {
    let basePattern = this.selectPattern(args.patternSelector);
    let mapping = args.mapping;
    let propertyName = mapping.properties.getNamespacedUriOfProperty(this.branchingArgs.name);
    let variableName = mapping.variables.getElementaryPropertyVariable(this.branchingArgs.name);
    let subPattern: gpatterns.TreeGraphPattern;

    if (this.branchingArgs.inverse === true)
      subPattern = basePattern.optionalInverseBranch(propertyName, variableName);
    else
      subPattern = basePattern.optionalBranch(propertyName, variableName);

    let result = args.clone();
    result.patternSelector = args.patternSelector.getOtherSelector(subPattern);
    result.mapping = undefined;
    return result;
  }

  private selectPattern(patternSelector: IGraphPatternSelector) {
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
  protected applyBranch(args: IGraphPatterngArgs & IMappingArgs & IScopedMappingArgs): ITraversingArgs {
    let basePattern = this.selectQueryRootPattern(args);
    let mapping = args.mapping;
    let rootVariableName = mapping.variables.getVariable();
    let collectionPropertyOData = this.branchingArgs.name;
    let collectionPropertyUri = mapping.properties.getNamespacedUriOfProperty(collectionPropertyOData);

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

    let result = args.clone();
    result.patternSelector = args.patternSelector.getOtherSelector(basePattern);
    result.mapping = args.scopedMapping.unscoped();
    result.scopedMapping = innerScopedMapping;
    return result;
  }

  private selectQueryRootPattern(args: IGraphPatterngArgs & IScopedMappingArgs) {
    let knownPattern = args.patternSelector.getRootPattern();
    let rootVariable = args.scopedMapping.unscoped().variables.getVariable();
    return knownPattern.looseBranch(rootVariable);
  }
}
