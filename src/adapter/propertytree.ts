import mappings = require("./mappings");
import gpatterns = require("../sparql/graphpatterns");
import schema = require("../odata/schema");

export class Tree {
  protected branches: Tree[] = [];

  public traverse(args: TraversingArgs): void {
    throw new Error("abstract method - not implemented");
  }

  public branch(branch: Tree): Tree {
    this.branches.push(branch);
    return branch;
  }

  public copyTo(tree: Tree) {
    this.branches.forEach(branch => {
      tree.branch(branch);
    });
  }
}

export interface BranchFactory {
  create(args: BranchingArgs): Tree;
}

export class TreeDependencyInjector implements BranchFactory {

  private candidates: TreeFactoryCandidate[] = [];

  public create(args: BranchingArgs): Tree {
    for (let i = 0; i < this.candidates.length; ++i) {
      let candidate = this.candidates[i];
      if (candidate.doesApply(args)) return candidate.create(args);
    }
    throw new Error("BranchingArgs don't apply to any of the registered candidates.");
  }

  public registerFactoryCandidates(...candidates: TreeFactoryCandidate[]) {
    this.candidates.push.apply(this.candidates, arguments);
    return this;
  }
}

export interface TreeFactoryCandidate {
  doesApply(args: BranchingArgs): boolean;
  create(args: BranchingArgs): Tree;
}

export interface GraphPatternSelector {
  select(args: BranchingArgs): gpatterns.TreeGraphPattern;
  getOtherSelector(rootPattern: gpatterns.TreeGraphPattern): GraphPatternSelector;
}

export interface BranchingArgs {
  property: string;
  inScopeVariable: boolean;
  inScopeVariableType?: schema.EntityType;
  loose?: boolean;
  inverse?: boolean;
  complex?: boolean;
  mandatory?: boolean;
  singleValued?: boolean;
  mirroredIdFrom?: string;
}

export interface TraversingArgs {
  patternSelector: GraphPatternSelector;
  mapping: mappings.Mapping;
}

export class RootTree extends Tree {

  public traverse(args: TraversingArgs): void {
    let innerArgs: TraversingArgs = {
      patternSelector: args.patternSelector,
      mapping: args.mapping,
    };
    this.branches.forEach(branch => {
      branch.traverse(innerArgs);
    });
  }
}

export class Branch extends Tree {

  constructor(protected branchingArgs: BranchingArgs) {
    super();
  }

  public traverse(args: TraversingArgs): void {
    let result = this.applyBranch(args);
    let subSelector = args.patternSelector.getOtherSelector(result.pattern);
    this.branches.forEach(branch => {
      branch.traverse({
        patternSelector: subSelector,
        mapping: result.mapping,
      });
    });
  }

  protected applyBranch(args: TraversingArgs): BranchingResult {
    throw new Error("abstract class - not implemented");
  }
}

export interface BranchingResult {
  mapping: mappings.Mapping;
  pattern: gpatterns.TreeGraphPattern;
}
