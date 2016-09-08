import base = require("./propertytree");
import gpatterns = require("../../sparql/graphpatterns");
import {
  ITraversingArgs, IGraphPatternArgs, IMappingArgs, IScopedMappingArgs, IGraphPatternSelector,
} from "./traversingargs";
import {
  IBranchingArgs, BranchingArgsGuard,
  IPropertyBranchingArgs, PropertyBranchingArgs, IInScopeVariableBranchingArgs, IAnyBranchingArgs,
} from "./branchingargs";
import { ForeignKeyPropertyResolver } from "../../odata/foreignkeyproperties";
import { Property } from "../../odata/schema";

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

export class ComplexBranchFactory implements base.ITreeFactoryCandidate {
  public doesApply(args: IBranchingArgs) {
    return BranchingArgsGuard.isProperty(args) && args.complex();
  }

  public create(args: IBranchingArgs) {
    if (BranchingArgsGuard.assertProperty(args))
      return new ComplexBranch(args);
  }
}

export class ComplexBranch implements base.INode {

  constructor(private branchingArgs: IPropertyBranchingArgs) {}

  public apply(args: IGraphPatternArgs & IMappingArgs): ITraversingArgs {
    let basePattern = this.selectPattern(args.patternSelector);
    let mapping = args.mapping;
    let propertyName = mapping.properties.getNamespacedUriOfProperty(this.branchingArgs.name());
    let variableName = mapping.variables.getComplexProperty(this.branchingArgs.name()).getVariable();
    let subPattern: gpatterns.TreeGraphPattern;

    if (this.branchingArgs.mandatory() === true) {
      if (this.branchingArgs.inverse() === true)
        subPattern = basePattern.inverseBranch(propertyName, variableName);
      else
        subPattern = basePattern.branch(propertyName, variableName);
    }
    else {
      if (this.branchingArgs.inverse() === true)
        subPattern = basePattern.optionalInverseBranch(propertyName, variableName);
      else
        subPattern = basePattern.optionalBranch(propertyName, variableName);
    }

    let subMapping = mapping.getSubMappingByComplexProperty(this.branchingArgs.name());

    let result = args.clone();
    result.mapping = subMapping;
    result.patternSelector = args.patternSelector.getOtherSelector(subPattern);
    return result;
  }

  public hash() {
    return this.branchingArgs.hash();
  }

  private selectPattern(patternSelector: IGraphPatternSelector) {
    if (this.branchingArgs.singleValued() === true)
      return patternSelector.getUnionPatternForSingleValuedBranches();
    else
      return patternSelector.getNewUnionPattern();
  }
}

// ===

export class ElementarySingleValuedBranchFactory implements base.ITreeFactoryCandidate {
  public doesApply(args: IBranchingArgs) {
    return BranchingArgsGuard.isProperty(args)
      && !args.complex() && args.singleValued();
  }

  public create(args: IBranchingArgs) {
    if (BranchingArgsGuard.assertProperty(args))
      return new ElementarySingleValuedBranch(args);
  }
}

export class ElementarySingleValuedBranch implements base.INode {
  private resolver = new ForeignKeyPropertyResolver();

  constructor(private branchingArgs: IPropertyBranchingArgs) {}

  public apply(args: IGraphPatternArgs) {
    const path: Property[] = this.resolver.resolveGetter(this.branchingArgs.schema());
    const nodes: base.INode[] = path.map(prop => new DirectElementarySingleValuedBranch(
      new PropertyBranchingArgs(prop)));

    let currentArgs = args.clone();
    for (let node of nodes) {
      currentArgs = node.apply(currentArgs);
    }
    return currentArgs;
  }

  public hash() {
    return this.branchingArgs.hash();
  }
}

export class DirectElementarySingleValuedBranch implements base.INode {

  constructor(private branchingArgs: IPropertyBranchingArgs) {}

  public apply(args: IGraphPatternArgs & IMappingArgs): ITraversingArgs {
    let basePattern = this.selectPattern(args.patternSelector);
    let mapping = args.mapping;
    let propertyName = mapping.properties.getNamespacedUriOfProperty(this.branchingArgs.name());
    let variableName = mapping.variables.getElementaryPropertyVariable(this.branchingArgs.name());
    let subPattern: gpatterns.TreeGraphPattern;

    if (this.branchingArgs.mandatory() === true) {
      if (this.branchingArgs.inverse() === true)
        subPattern = basePattern.inverseBranch(propertyName, variableName);
      else
        subPattern = basePattern.branch(propertyName, variableName);
    }
    else {
      if (this.branchingArgs.inverse() === true)
        subPattern = basePattern.optionalInverseBranch(propertyName, variableName);
      else
        subPattern = basePattern.optionalBranch(propertyName, variableName);
    }

    let result = args.clone();
    result.patternSelector = args.patternSelector.getOtherSelector(subPattern);
    result.mapping = undefined;
    return result;
  }

  public hash() {
    return this.branchingArgs.hash();
  }

  private selectPattern(patternSelector: IGraphPatternSelector) {
    if (this.branchingArgs.name() === "Id")
      return patternSelector.getRootPattern();
    else
      return patternSelector.getUnionPatternForSingleValuedBranches();
  }
}

// ===

export class InScopeVariableBranchFactory implements base.ITreeFactoryCandidate {

  public doesApply(args: IBranchingArgs) {
    return args.type() === "inScopeVariable";
  }

  public create(args: IBranchingArgs) {
    if (BranchingArgsGuard.assertInScopeVariable(args))
      return new InScopeVariableBranch(args);
  }
}

export class InScopeVariableBranch implements base.INode {

  constructor(private branchingArgs: IInScopeVariableBranchingArgs) {}

  public apply(args: ITraversingArgs): ITraversingArgs {
    let basePattern = this.selectPattern(args.patternSelector);
    let scopedMapping = args.scopedMapping;
    let innerPattern = basePattern.looseBranch(
      scopedMapping.getNamespace(this.branchingArgs.name()).variables.getVariable());

    let innerArgs = args.clone();
    innerArgs.mapping = scopedMapping.getNamespace(this.branchingArgs.name());
    innerArgs.patternSelector = args.patternSelector.getOtherSelector(innerPattern);
    return innerArgs;
  }

  public hash() {
    return this.branchingArgs.hash();
  }

  private selectPattern(patternSelector: IGraphPatternSelector) {
    return patternSelector.getRootPattern();
  }
}

// ===

export class ComplexBranchFactoryForFiltering implements base.ITreeFactoryCandidate {
  public doesApply(args: IBranchingArgs) {
    return BranchingArgsGuard.isProperty(args)
      && args.complex() && args.singleValued();
  }

  public create(args: IBranchingArgs) {
    if (BranchingArgsGuard.assertProperty(args))
      return new ComplexBranchForFiltering(args);
  }
}

export class ComplexBranchForFiltering implements base.INode {

  constructor(private branchingArgs: IPropertyBranchingArgs) {}

  public apply(args: IGraphPatternArgs & IMappingArgs): ITraversingArgs {
    let basePattern = this.selectPattern(args.patternSelector);
    let mapping = args.mapping;
    let propertyName = mapping.properties.getNamespacedUriOfProperty(this.branchingArgs.name());
    let variableName = mapping.variables.getComplexProperty(this.branchingArgs.name()).getVariable();
    let subPattern: gpatterns.TreeGraphPattern;

    if (this.branchingArgs.inverse() === true)
      subPattern = basePattern.optionalInverseBranch(propertyName, variableName);
    else
      subPattern = basePattern.optionalBranch(propertyName, variableName);

    let subMapping = mapping.getSubMappingByComplexProperty(this.branchingArgs.name());

    let result = args.clone();
    result.patternSelector = args.patternSelector.getOtherSelector(subPattern);
    result.mapping = subMapping;
    return result;
  }

  public hash() {
    return this.branchingArgs.hash();
  }

  private selectPattern(patternSelector: IGraphPatternSelector) {
    return patternSelector.getRootPattern();
  }
}

// ===

export class ElementaryBranchFactoryForFiltering implements base.ITreeFactoryCandidate {
  public doesApply(args: IBranchingArgs) {
    return BranchingArgsGuard.isProperty(args)
      && !args.complex() && args.singleValued();
  }

  public create(args: IBranchingArgs) {
    if (BranchingArgsGuard.assertProperty(args))
      return new ElementaryBranchForFiltering(args);
  }
}

export class ElementaryBranchForFiltering implements base.INode {

  constructor(private branchingArgs: IPropertyBranchingArgs) {}

  public apply(args: IGraphPatternArgs & IMappingArgs): ITraversingArgs {
    let basePattern = this.selectPattern(args.patternSelector);
    let mapping = args.mapping;
    let propertyName = mapping.properties.getNamespacedUriOfProperty(this.branchingArgs.name());
    let variableName = mapping.variables.getElementaryPropertyVariable(this.branchingArgs.name());
    let subPattern: gpatterns.TreeGraphPattern;

    if (this.branchingArgs.inverse() === true)
      subPattern = basePattern.optionalInverseBranch(propertyName, variableName);
    else
      subPattern = basePattern.optionalBranch(propertyName, variableName);

    let result = args.clone();
    result.patternSelector = args.patternSelector.getOtherSelector(subPattern);
    result.mapping = undefined;
    return result;
  }

  public hash() {
    return this.branchingArgs.hash();
  }

  private selectPattern(patternSelector: IGraphPatternSelector) {
    return patternSelector.getRootPattern();
  }
}

// ===

export class AnyBranchFactory implements base.ITreeFactoryCandidate {
  public doesApply(args: IBranchingArgs) {
    return args.type() === "any";
  }

  public create(args: IBranchingArgs) {
    if (BranchingArgsGuard.assertAny(args))
      return new AnyBranch(args);
  }
}

export class AnyBranch implements base.INode {

  constructor(private branchingArgs: IAnyBranchingArgs) {}

  /**
   * args.mapping should be the last property before the any-ed collection property, say X.
   * args.patternSelector should be based on the branch on top of X.
   */
  public apply(args: IGraphPatternArgs & IMappingArgs & IScopedMappingArgs): ITraversingArgs {
    let basePattern = this.selectQueryRootPattern(args);
    let mapping = args.mapping;
    let rootVariableName = mapping.variables.getVariable();
    let collectionPropertyOData = this.branchingArgs.name();
    let collectionPropertyUri = mapping.properties.getNamespacedUriOfProperty(collectionPropertyOData);

    let lambdaVariable = this.branchingArgs.lambdaVariable();
    let innerScopedMapping = args.scopedMapping.scope(lambdaVariable.scopeId);
    innerScopedMapping.setNamespace(lambdaVariable.name, lambdaVariable.entityType);
    let lambdaSparqlVariable = innerScopedMapping.getNamespace(lambdaVariable.name).variables.getVariable();

    if (this.branchingArgs.inverse) {
      basePattern
        .looseBranch(rootVariableName)
        .optionalInverseBranch(collectionPropertyUri, lambdaSparqlVariable);
    }
    else {
      basePattern
        .looseBranch(rootVariableName)
        .optionalBranch(collectionPropertyUri, lambdaSparqlVariable);
    }

    let result = args.clone();
    result.patternSelector = args.patternSelector.getOtherSelector(basePattern);
    result.mapping = args.scopedMapping.unscoped();
    result.scopedMapping = innerScopedMapping;
    return result;
  }

  public hash() {
    return this.branchingArgs.hash();
  }

  private selectQueryRootPattern(args: IGraphPatternArgs & IScopedMappingArgs) {
    let knownPattern = args.patternSelector.getRootPattern();
    let rootVariable = args.scopedMapping.unscoped().variables.getVariable();
    return knownPattern.looseBranch(rootVariable);
  }
}
