import mappings = require("./mappings");
import gpatterns = require("../sparql/graphpatterns");
import schema = require("../odata/schema");
import filters = require("./filters");

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
  getRootPattern(): gpatterns.TreeGraphPattern;
  getUnionPatternForSingleValuedBranches(): gpatterns.TreeGraphPattern;
  getNewUnionPattern(): gpatterns.TreeGraphPattern;

  getOtherSelector(rootPattern: gpatterns.TreeGraphPattern): GraphPatternSelector;
}

export interface BranchingArgs {
  type: "any" | "property" | "inScopeVariable";
  name: string;
  lambdaExpression?: filters.LambdaExpression;
  inScopeVariableType?: schema.EntityType;
  loose?: boolean;
  inverse?: boolean;
  complex?: boolean;
  mandatory?: boolean;
  singleValued?: boolean;
  mirroredIdFrom?: string;
}

export class BranchingArgsHasher {
  public hash(args: BranchingArgs): string {
    return JSON.stringify({
      property: args.name,
      inScopeVariable: args.name,
    });
  }
}

export interface TraversingArgs {
  patternSelector: GraphPatternSelector;
  mapping: mappings.Mapping;
  scopedMapping: mappings.ScopedMapping;
}

export class RootTree extends Tree {

  public traverse(args: TraversingArgs): void {
    for (let hash of Object.keys(this.branches)) {
      this.branches[hash].traverse(args);
    }
  }
}

export class Branch extends Tree {

  constructor(protected branchingArgs: BranchingArgs) {
    super();
  }

  public traverse(args: TraversingArgs): void {
    let result = this.applyBranch(args);
    let subSelector = args.patternSelector.getOtherSelector(result.pattern);
    for (let hash of Object.keys(this.branches)) {
      let branch = this.branches[hash];
      branch.traverse({
        patternSelector: subSelector,
        mapping: result.mapping,
        scopedMapping: result.scopedMapping,
      });
    }
  }

  public hash() {
    return new BranchingArgsHasher().hash(this.branchingArgs);
  }

  protected applyBranch(args: TraversingArgs): BranchingResult {
    throw new Error("abstract class - not implemented");
  }
}

export interface BranchingResult {
  mapping: mappings.Mapping;
  scopedMapping: mappings.ScopedMapping;
  pattern: gpatterns.TreeGraphPattern;
}
