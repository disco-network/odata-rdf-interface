import { TraversingArgs } from "./traversingargs";
import { IBranchingArgs } from "./branchingargs";

export class Tree {
  protected branches: { [id: string]: Tree } = {};

  public traverse(args: TraversingArgs): void {
    throw new Error("abstract method - not implemented");
  }

  public hash(): string {
    throw new Error("abstract method - not implemented");
  }

  public branch(branch: Tree): Tree {
    if (!Object.prototype.hasOwnProperty.call(this.branches, branch.hash())) {
      this.branches[branch.hash()] = branch;
    }
    return this.branches[branch.hash()];
  }

  public copyTo(tree: Tree) {
    for (let hash of Object.keys(this.branches)) {
      tree.branch(this.branches[hash]);
    }
  }
}

export interface IBranchFactory<T extends IBranchingArgs> {
  create(args: T): Tree;
}

export class TreeDependencyInjector implements IBranchFactory<IBranchingArgs> {

  private candidates: ITreeFactoryCandidate[] = [];

  public create(args: IBranchingArgs): Tree {
    for (let i = 0; i < this.candidates.length; ++i) {
      let candidate = this.candidates[i];
      if (candidate.doesApply(args)) return candidate.create(args);
    }
    throw new Error("BranchingArgs don't apply to any of the registered candidates.");
  }

  public registerFactoryCandidates(...candidates: ITreeFactoryCandidate[]) {
    this.candidates.push.apply(this.candidates, candidates);
    return this;
  }
}

export interface ITreeFactoryCandidate {
  doesApply(args: IBranchingArgs): boolean;
  create(args: IBranchingArgs): Tree;
}

export class BranchingArgsHasher {
  public hash(args: IBranchingArgs): string {
    // @smell how to guarantee that the hashing function keeps correct and
    // groups the branches considered equal?
    return args.hash();
  }
}

export class RootTree extends Tree {

  public traverse(args: TraversingArgs): void {
    for (let hash of Object.keys(this.branches)) {
      this.branches[hash].traverse(args);
    }
  }
}

export class Branch<Args extends IBranchingArgs> extends Tree {

  constructor(protected branchingArgs: Args) {
    super();
  }

  public traverse(args: TraversingArgs): void {
    let subArgs = this.applyBranch(args);
    for (let hash of Object.keys(this.branches)) {
      let branch = this.branches[hash];
      branch.traverse(subArgs);
    }
  }

  public hash() {
    return new BranchingArgsHasher().hash(this.branchingArgs);
  }

  protected applyBranch(args: TraversingArgs): TraversingArgs {
    throw new Error("abstract class - not implemented");
  }
}

/* @canremove export interface IBranchingResult {
  mapping: mappings.Mapping;
  scopedMapping: mappings.ScopedMapping;
  pattern: gpatterns.TreeGraphPattern;
}*/
