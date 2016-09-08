import base = require("./propertytree/propertytree");
import {
  IBranchingArgs, IForeignKeyPropertyBranchingArgs, IPropertyBranchingArgs, PropertyBranchingArgs,
  BranchingArgsGuard } from "./propertytree/branchingargs";
import {
  ITraversingArgs, IGraphPatternSelector, IGraphPatternArgs,
} from "./propertytree/traversingargs";
import { ForeignKeyPropertyResolver } from "../odata/foreignkeyproperties";

export class SingleValuedForeignKeyBranchFactory implements base.ITreeFactoryCandidate {

  constructor(private complexDirectBranchFactory: base.ITreeFactoryCandidate) {
  }

  public doesApply(args: IBranchingArgs) {
    return BranchingArgsGuard.isForeignKeyProperty(args)
      && this.complexDirectBranchFactory.doesApply(args.foreignProperty());
  }

  public create(args: IBranchingArgs) {
    if (BranchingArgsGuard.assertForeignKeyProperty(args))
      return new SingleValuedForeignKeyBranch(args, this.complexDirectBranchFactory);
  }
}

export class SingleValuedForeignKeyBranch implements base.INode {
  private resolver = new ForeignKeyPropertyResolver();

  constructor(private branchingArgs: IForeignKeyPropertyBranchingArgs,
              private complexDirectBranchFactory: base.IBranchFactory<IPropertyBranchingArgs>) {
  }

  public hash() {
    return this.branchingArgs.hash();
  }

  public apply(args: IGraphPatternArgs): ITraversingArgs {
    this.resolver.resolveGetter(this.branchingArgs.)
    const branch = this.complexDirectBranchFactory.create(this.branchingArgs.foreignProperty());
    const idProperty = this.branchingArgs.foreignProperty().schema().getEntityType().getProperty("Id");
    const idBranch = this.complexDirectBranchFactory.create(new PropertyBranchingArgs(idProperty));

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
