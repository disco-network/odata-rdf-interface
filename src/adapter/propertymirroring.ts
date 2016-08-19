import base = require("./propertytree/propertytree");
import {
  IBranchingArgs, IMirrorPropertyBranchingArgs,
  BranchingArgsGuard } from "./propertytree/branchingargs";
import {
  IGraphPatternSelector,
  ITraversingArgs, IGraphPatternArgs, IMappingArgs,
} from "./propertytree/traversingargs";

export class SingleValuedMirrorBranchFactory implements base.ITreeFactoryCandidate {

  public doesApply(args: IBranchingArgs) {
    return BranchingArgsGuard.isMirrorProperty(args)
      && args.mirroredProperty().complex()
      && args.mirroredProperty().singleValued()
      && !args.mirroredProperty().inverse();
  }

  public create(args: IBranchingArgs) {
    if (BranchingArgsGuard.assertMirrorProperty(args))
      return new SingleValuedMirrorBranch(args);
  }
}

export class SingleValuedMirrorBranch extends base.Branch<IMirrorPropertyBranchingArgs> {

  protected applyBranch(args: IGraphPatternArgs & IMappingArgs): ITraversingArgs {

    let mapping = args.mapping;
    let complexPropertyName = this.branchingArgs.mirroredProperty().name();
    let complexPropertyUri =
      mapping.properties.getNamespacedUriOfProperty(complexPropertyName);
    let idPropertyUri = mapping.getSubMappingByComplexProperty(complexPropertyName)
      .properties.getNamespacedUriOfProperty("Id");

    let intermediateVariableName = mapping.variables.getComplexProperty(complexPropertyName)
      .getVariable();
    let variableName = mapping.variables.getElementaryPropertyVariable(this.branchingArgs.name());

    let basePattern = this.selectPattern(args.patternSelector);
    let subPattern = this.branchingArgs.mirroredProperty().mandatory() === true ?
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
