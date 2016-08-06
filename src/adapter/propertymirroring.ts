import base = require("./propertytree/propertytree");
import {
  IBranchingArgs, IPropertyBranchingArgs,
  BranchingArgsGuard } from "./propertytree/branchingargs";
import {
  IGraphPatternSelector,
  ITraversingArgs, IGraphPatternArgs, IMappingArgs,
} from "./propertytree/traversingargs";

/* @smell always having to check that mirroredIdFrom !== undefined violates OCP */
export class ElementarySingleValuedMirroredBranchFactory implements base.ITreeFactoryCandidate {
  public doesApply(args: IBranchingArgs) {
    return BranchingArgsGuard.isProperty(args)
      && !args.complex && args.mirroredIdFrom !== undefined && args.singleValued && !args.inverse;
  }

  public create(args: IBranchingArgs) {
    if (BranchingArgsGuard.assertProperty(args))
      return new ElementarySingleValuedMirroredBranch(args);
  }
}

export class ElementarySingleValuedMirroredBranch extends base.Branch<IPropertyBranchingArgs> {

  protected applyBranch(args: IGraphPatternArgs & IMappingArgs): ITraversingArgs {

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
