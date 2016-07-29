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

export type BranchingArgs = PropertyBranchingArgs | InScopeVariableBranchingArgs | AnyBranchingArgs;

export interface PropertyBranchingArgs {
  type: "property";
  name: string;
  loose: boolean;
  inverse: boolean;
  complex: boolean;
  mandatory: boolean;
  singleValued: boolean;
  mirroredIdFrom: string;
}

export interface InScopeVariableBranchingArgs {
  type: "inScopeVariable";
  name: string;
  variableType: schema.EntityType;
}

export interface AnyBranchingArgs {
  type: "any";
  name: string;
  lambdaExpression: filters.LambdaExpression;
  inverse: boolean;
}

export class BranchingArgsGuard {
  public static isProperty(args: BranchingArgs): args is PropertyBranchingArgs {
    return args.type === "property";
  }

  public static isInScopeVariable(args: BranchingArgs): args is InScopeVariableBranchingArgs {
    return args.type === "inScopeVariable";
  }

  public static isAny(args: BranchingArgs): args is AnyBranchingArgs {
    return args.type === "any";
  }

  public static assertProperty(args: BranchingArgs): args is PropertyBranchingArgs {
    if (this.isProperty(args)) return true;
    else throw new Error("PropertyBranchingArgs expected");
  }

  public static assertInScopeVariable(args: BranchingArgs): args is InScopeVariableBranchingArgs {
    if (this.isInScopeVariable(args)) return true;
    else throw new Error("InScopeVariableBranchingArgs expected");
  }

  public static assertAny(args: BranchingArgs): args is AnyBranchingArgs {
    if (this.isAny(args)) return true;
    else throw new Error("AnyBranchingArgs expected");
  }
}

class PropertyBranchingArgsBuilderTemplate<Value extends { type: "property" }> {
  public value: Value;

  public name(name: string) {
    return this.set({ name: name });
  }

  public complex(value: boolean) {
    return this.set({ complex: value });
  }

  public mandatory(value: boolean) {
    return this.set({ mandatory: value });
  }

  public singleValued(value: boolean) {
    return this.set({ singleValued: value });
  }

  public inverse(value: boolean) {
    return this.set({ inverse: value });
  }

  public loose(value: boolean) {
    return this.set({ loose: value });
  }

  public mirroredIdFrom(value: string) {
    return this.set({ mirroredIdFrom: value });
  }

  private set<T>(value: T): PropertyBranchingArgsBuilderTemplate<Value & T> {
    for (let key of Object.keys(value)) {
      this.value[key] = value[key];
    }
    return this as any as PropertyBranchingArgsBuilderTemplate<Value & T>;
  }
}

export class PropertyBranchingArgsBuilder extends PropertyBranchingArgsBuilderTemplate<{ type: "property" }> {
  public value = { type: <"property"> "property" };
}

class InScopeBranchingArgsBuilderTemplate<Value extends { type: "inScopeVariable" }> {
  public value: Value;

  public name(name: string) {
    return this.set({ name: name });
  }

  public variableType(type: schema.EntityType) {
    return this.set({ variableType: type });
  }

  private set<T>(value: T): InScopeBranchingArgsBuilderTemplate<Value & T> {
    for (let key of Object.keys(value)) {
      this.value[key] = value[key];
    }
    return this as any as InScopeBranchingArgsBuilderTemplate<Value & T>;
  }
}

export class InScopeBranchingArgsBuilder extends InScopeBranchingArgsBuilderTemplate<{ type: "inScopeVariable" }> {
  public value = { type: <"inScopeVariable"> "inScopeVariable" };
}

class AnyBranchingArgsBuilderTemplate<Value extends { type: "any" }> {
  public value: Value;

  public name(value: string) {
    this.set({ name: value });
  }

  public lambdaExpression(value: filters.LambdaExpression) {
    this.set({ lambdaExpression: value });
  }

  public inverse(value: boolean) {
    this.set({ inverse: value });
  }

  private set<T>(value: T): AnyBranchingArgsBuilderTemplate<Value & T> {
    for (let key of Object.keys(value)) {
      this.value[key] = value[key];
    }
    return this as any as AnyBranchingArgsBuilderTemplate<Value & T>;
  }
}

export class AnyBranchingArgsBuilder extends AnyBranchingArgsBuilderTemplate<{ type: "any" }> {
  public value = { type: <"any"> "any" };
}

export class BranchingArgsHasher {
  public hash(args: BranchingArgs): string {
    // @smell how to guarantee that the hashing function keeps correct and
    // groups the branches considered equal?
    return JSON.stringify({
      type: args.type,
      name: args.name,
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

export class Branch<Args extends BranchingArgs> extends Tree {

  constructor(protected branchingArgs: Args) {
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
