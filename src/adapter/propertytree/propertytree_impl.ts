import base = require("./propertytree");
import gpatterns = require("../../sparql/graphpatterns");
import {
  ITraversingArgs, IGraphPatternArgs, IMappingArgs, IScopedMappingArgs, IGraphPatternSelector,
} from "./traversingargs";
import {
  IBranchingArgs, BranchingArgsGuard,
  IPropertyBranchingArgs, PropertyBranchingArgs, IInScopeVariableBranchingArgs, IAnyBranchingArgs,
  ITypeConditionBranchingArgs,
} from "./branchingargs";
import { ForeignKeyPropertyResolver } from "../../odata/foreignkeyproperties";
import { Property } from "../../odata/schema";

/**
 * Selects the graph patterns to branch on for those properties which are shown (expanded) in the query result.
 */
export class GraphPatternSelector implements IGraphPatternSelector {

  constructor(private rootPattern: gpatterns.TreeGraphPattern) {
    this.createNewUnionPattern();
  }

  public getRootPattern() {
    return this.rootPattern;
  }

  public getUnionPatternForSingleValuedBranches() {
    return this.createNewUnionPattern();
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

export class TypeConditionBranchFactory implements base.ITreeFactoryCandidate {
  public doesApply(args: IBranchingArgs) {
    return BranchingArgsGuard.isTypeCondition(args);
  }

  public create(args: IBranchingArgs) {
    return new TypeConditionBranch(BranchingArgsGuard.assertTypeCondition(args));
  }
}

export class TypeConditionBranch implements base.INode {

  constructor(private branchingArgs: ITypeConditionBranchingArgs) {}

  public apply(args: IGraphPatternArgs & IMappingArgs): undefined {
    const basePattern = args.patternSelector.getRootPattern();

    basePattern.branch("rdf:type", this.branchingArgs.entityType().getNamespacedUri());

    return undefined;
  }

  public hash() {
    return this.branchingArgs.hash();
  }
}

// ===

export class ComplexBranchFactory implements base.ITreeFactoryCandidate {
  public doesApply(args: IBranchingArgs) {
    return BranchingArgsGuard.isProperty(args) && args.complex();
  }

  public create(args: IBranchingArgs) {
    return new ComplexBranch(BranchingArgsGuard.assertProperty(args));
  }
}

export class ComplexBranch implements base.INode {

  constructor(private branchingArgs: IPropertyBranchingArgs) {}

  public apply(args: IGraphPatternArgs & IMappingArgs): ITraversingArgs {
    const basePattern = this.selectPattern(args.patternSelector);
    const mapping = args.mapping;
    const propertyName = mapping.properties.getNamespacedUriOfProperty(this.branchingArgs.name());
    const variableName = mapping.variables.getComplexProperty(this.branchingArgs.name()).getVariable();
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

  constructor(private /* @smell */ branchFactory: base.IBranchFactory<PropertyBranchingArgs>) {}

  public doesApply(args: IBranchingArgs) {
    return BranchingArgsGuard.isProperty(args)
      && !args.complex() && args.singleValued();
  }

  public create(args: IBranchingArgs) {
    return new ElementarySingleValuedBranch(BranchingArgsGuard.assertProperty(args), this.branchFactory);
  }
}

class DirectElementarySingleValuedBranchFactory implements base.ITreeFactoryCandidate {

  public doesApply(args: IBranchingArgs) {
    return BranchingArgsGuard.isProperty(args)
      && !args.complex() && args.singleValued();
  }

  public create(args: IBranchingArgs) {
    if (this.doesApply(args))
      return new DirectElementarySingleValuedBranch(BranchingArgsGuard.assertProperty(args));
    else
      throw new Error("property is not elementary and single-valued");
  }
}

export class ElementarySingleValuedBranch implements base.INode {
  private resolver = new ForeignKeyPropertyResolver();
  private branchFactory: base.IBranchFactory<IPropertyBranchingArgs>;

  constructor(private branchingArgs: IPropertyBranchingArgs,
              branchFactory: base.IBranchFactory<IPropertyBranchingArgs>) {
    this.branchFactory = lexicalPriorityBranchFactory(
      new DirectElementarySingleValuedBranchFactory(), branchFactory);
  }

  public apply(args: IGraphPatternArgs) {
    const path: Property[] = this.resolver.resolveGetter(this.branchingArgs.schema());
    const nodes: base.INode[] = path.map(prop => this.branchFactory.create(new PropertyBranchingArgs(prop)));

    let currentArgs: ITraversingArgs | undefined = args.clone();
    for (let node of nodes) {
      if (currentArgs)
        currentArgs = node.apply(currentArgs);
      else
        throw new Error("Leaf nodes can't have branches");
    }
    return currentArgs;
  }

  public hash() {
    return this.branchingArgs.hash();
  }
}

function lexicalPriorityBranchFactory<T extends IBranchingArgs>
  (...factories: base.IBranchFactory<T>[]): base.IBranchFactory<T> {
  return { create: function(args: T) {
    let lastException;
    for (let fty of factories) {
      try {
        return fty.create(args);
      }
      catch (e) {
        lastException = e;
      }
    }
    throw lastException;
  } };
}

export class DirectElementarySingleValuedBranch implements base.INode {

  constructor(private branchingArgs: IPropertyBranchingArgs) {}

  public apply(args: IGraphPatternArgs & IMappingArgs): ITraversingArgs | undefined {
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

    return undefined;
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
    return new InScopeVariableBranch(BranchingArgsGuard.assertInScopeVariable(args));
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
    return new ComplexBranchForFiltering(BranchingArgsGuard.assertProperty(args));
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
    return new ElementaryBranchForFiltering(BranchingArgsGuard.assertProperty(args));
  }
}

export class ElementaryBranchForFiltering implements base.INode {

  constructor(private branchingArgs: IPropertyBranchingArgs) {}

  public apply(args: IGraphPatternArgs & IMappingArgs): undefined {
    let basePattern = this.selectPattern(args.patternSelector);
    let mapping = args.mapping;
    let propertyName = mapping.properties.getNamespacedUriOfProperty(this.branchingArgs.name());
    let variableName = mapping.variables.getElementaryPropertyVariable(this.branchingArgs.name());
    let subPattern: gpatterns.TreeGraphPattern;

    if (this.branchingArgs.inverse() === true)
      subPattern = basePattern.optionalInverseBranch(propertyName, variableName);
    else
      subPattern = basePattern.optionalBranch(propertyName, variableName);

    return undefined;
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
    return new AnyBranch(BranchingArgsGuard.assertAny(args));
  }
}

export class AnyBranch implements base.INode {

  constructor(private branchingArgs: IAnyBranchingArgs) {}

  /**
   * args.mapping should be the last property before the any-ed collection property, say X.
   * args.patternSelector should be based on the branch on top of X.
   */
  public apply(args: IGraphPatternArgs & IMappingArgs & IScopedMappingArgs): ITraversingArgs {
    const basePattern = this.selectQueryRootPattern(args);
    const mapping = args.mapping;
    const rootVariableName = mapping.variables.getVariable();
    const collectionPropertyOData = this.branchingArgs.name();
    const collectionPropertyUri = mapping.properties.getNamespacedUriOfProperty(collectionPropertyOData);

    const lambdaVariable = this.branchingArgs.lambdaVariable();
    const innerScopedMapping = args.scopedMapping.scope(lambdaVariable.scopeId);
    innerScopedMapping.setNamespace(lambdaVariable.name, lambdaVariable.entityType);
    const lambdaSparqlVariable = innerScopedMapping.getNamespace(lambdaVariable.name).variables.getVariable();

    if (this.branchingArgs.inverse) {
      basePattern
        .looseBranch(rootVariableName)
        .inverseBranch(collectionPropertyUri, lambdaSparqlVariable);
    }
    else {
      basePattern
        .looseBranch(rootVariableName)
        .branch(collectionPropertyUri, lambdaSparqlVariable);
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
