import base = require("./propertytree/propertytree");
import {
  IBranchingArgs, IMirrorPropertyBranchingArgs, IPropertyBranchingArgs,
  BranchingArgsGuard } from "./propertytree/branchingargs";
import {
  ITraversingArgs, IGraphPatternSelector,
  IGraphPatternArgs, IMappingArgs,
} from "./propertytree/traversingargs";

export class SingleValuedMirrorBranchFactory implements base.ITreeFactoryCandidate {

  constructor(private complexNonMirrorBranchFactory: base.ITreeFactoryCandidate) {
  }

  public doesApply(args: IBranchingArgs) {
    return BranchingArgsGuard.isMirrorProperty(args)
      && this.complexNonMirrorBranchFactory.doesApply(args.mirroredProperty());
  }

  public create(args: IBranchingArgs) {
    if (BranchingArgsGuard.assertMirrorProperty(args))
      return new SingleValuedMirrorBranch(args, this.complexNonMirrorBranchFactory);
  }
}

export class SingleValuedMirrorBranch implements base.INode {

  constructor(private branchingArgs: IMirrorPropertyBranchingArgs,
              private complexNonMirrorBranchFactory: base.IBranchFactory<IPropertyBranchingArgs>) {
  }

  public hash() {
    return this.branchingArgs.hash();
  }

  public apply(args: IGraphPatternArgs & IMappingArgs): ITraversingArgs {
    let branch = this.complexNonMirrorBranchFactory.create(this.branchingArgs.mirroredProperty());
    let branchMapping = args.mapping.getSubMappingByComplexProperty(this.branchingArgs.mirroredProperty().name());
    let propertyName = branchMapping.properties.getNamespacedUriOfProperty("Id");
    let variableName = args.mapping.variables.getElementaryPropertyVariable(this.branchingArgs.name());
    let idBranch = new IdBranch(propertyName, variableName);

    return idBranch.apply(branch.apply(args.clone()));
  }
}

class IdBranch implements base.INode {
  constructor(private propertyName: string, private variableName: string) {
  }

  public hash() {
    return JSON.stringify({ type: "id" });
  }

  public apply(args: IGraphPatternArgs): ITraversingArgs {
    let pattern = this.selectPattern(args.patternSelector);
    let subPattern = pattern.branch(this.propertyName, this.variableName);

    let subArgs = args.clone();
    subArgs.patternSelector = args.patternSelector.getOtherSelector(subPattern);
    subArgs.mapping = null;
    return subArgs;
  }

  private selectPattern(patternSelector: IGraphPatternSelector) {
    return patternSelector.getRootPattern();
  }
}
