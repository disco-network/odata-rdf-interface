import { TraversingArgs } from "./traversingargs";
import { IBranchingArgs } from "./branchingargs";

export interface INode {
  hash(): string;
  apply(args: TraversingArgs): TraversingArgs | undefined;
}

export class NullNode {
  public hash(): string {
    return "null";
  }

  public apply(args: TraversingArgs) {
    return args;
  }
}

export class Tree {
  private branches: { [id: string]: Tree } = {};

  constructor(private node: INode = new NullNode()) {}

  public traverse(args: TraversingArgs): void {
    let subArgs = this.node.apply(args);
    for (let key of Object.keys(this.branches)) {
      let branch = this.branches[key];
      if (subArgs)
        branch.traverse(subArgs);
      else throw new Error("Leaf nodes can't have branches");
    }
  }

  public hashOfNode(): string {
    return this.node.hash();
  }

  public branchNode(branch: INode): Tree {
    if (!Object.prototype.hasOwnProperty.call(this.branches, branch.hash())) {
      this.branches[branch.hash()] = new Tree(branch);
    }
    return this.branches[branch.hash()];
  }

  public branchTree(branch: Tree): Tree {
    if (!Object.prototype.hasOwnProperty.call(this.branches, branch.hashOfNode())) {
      this.branches[branch.hashOfNode()] = branch;
    }
    else {
      branch.copyTo(this.branches[branch.hashOfNode()]);
    }
    return this.branches[branch.hashOfNode()];
  }

  public copyTo(tree: Tree) {
    for (let hash of Object.keys(this.branches)) {
      tree.branchTree(this.branches[hash]);
    }
  }
}

export interface IBranchFactory<T extends IBranchingArgs> {
  create(args: T): INode;
}

export class TreeDependencyInjector implements IBranchFactory<IBranchingArgs> {

  private candidates: ITreeFactoryCandidate[] = [];

  public create(args: IBranchingArgs): INode {
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

export interface ITreeFactoryCandidate extends IBranchFactory<IBranchingArgs> {
  doesApply(args: IBranchingArgs): boolean;
  create(args: IBranchingArgs): INode;
}
