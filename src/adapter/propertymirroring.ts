import base = require("./propertytree/propertytree");
import {
  IBranchingArgs, IMirrorPropertyBranchingArgs, IPropertyBranchingArgs,
  BranchingArgsGuard } from "./propertytree/branchingargs";
import {
  IGraphPatternSelector,
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

export class SingleValuedMirrorBranch extends base.Tree {

  constructor(private branchingArgs: IMirrorPropertyBranchingArgs,
              private complexNonMirrorBranchFactory: base.IBranchFactory<IPropertyBranchingArgs>) {
    super();
  }

  public hash() {
    return this.branchingArgs.hash();
  }

  public traverse(args: IGraphPatternArgs & IMappingArgs): void {
    let branch = this.complexNonMirrorBranchFactory.create(this.branchingArgs.mirroredProperty());
    let branchMapping = args.mapping.getSubMappingByComplexProperty(this.branchingArgs.mirroredProperty().name());
    let propertyName = branchMapping.properties.getNamespacedUriOfProperty("Id");
    let variableName = args.mapping.variables.getElementaryPropertyVariable(this.branchingArgs.name());
    let idBranch = branch.branch(new IdBranch(propertyName, variableName));
    this.copyTo(idBranch);

    branch.traverse(args.clone());
  }
}

class IdBranch extends base.Tree {
  constructor(private propertyName: string, private variableName: string) {
    super();
  }

  public hash() {
    return JSON.stringify({ type: "id" });
  }

  public traverse(args: IGraphPatternArgs) {
    let pattern = this.selectPattern(args.patternSelector);
    let subPattern = pattern.branch(this.propertyName, this.variableName);

    let subArgs = args.clone();
    subArgs.patternSelector = args.patternSelector.getOtherSelector(subPattern);
    subArgs.mapping = null;

    for (let hash of Object.keys(this.branches)) {
      this.branches[hash].traverse(subArgs);
    }
  }

  private selectPattern(patternSelector: IGraphPatternSelector) {
    return patternSelector.getRootPattern();
  }
}
