/**
 * Provides a SPARQL graph pattern whose triples are generated from a
 * property tree
 */
export class TreeGraphPattern {
  private rootName: string;
  private branchPattern: GraphPatternWithBranches;
  private inverseBranchPattern: GraphPatternWithBranches;
  private optionalBranchPattern: GraphPatternWithBranches;
  private optionalInverseBranchPattern: GraphPatternWithBranches;

  private valueLeaves: { [id: string]: ValueLeaf[] } = {};
  private unionPatterns: TreeGraphPattern[] = [];
  private conjunctivePatterns: TreeGraphPattern[] = [];

  constructor(rootName: string) {
    let createTriple = (property: string, branch: TreeGraphPattern) => {
      return [this.name(), property, branch.name()];
    };

    let createInverseTriple = (property: string, branch: TreeGraphPattern) => {
      return [branch.name(), property, this.name()];
    };

    this.rootName = rootName;
    this.branchPattern = new GraphPatternWithBranches(createTriple);
    this.inverseBranchPattern = new GraphPatternWithBranches(createInverseTriple);
    this.optionalBranchPattern = new GraphPatternWithBranches(createTriple);
    this.optionalInverseBranchPattern = new GraphPatternWithBranches(createInverseTriple);
  }

  public getDirectTriples(): any[][] {
    let triples: any[][] = [];

    for (let property in this.valueLeaves) {
      let leaves = this.valueLeaves[property];
      leaves.forEach(leaf => {
        triples.push([ this.name(), property, "\"" + leaf.value + "\"" ]);
      });
    }

    triples.push.apply(triples, this.branchPattern.getDirectTriples());
    triples.push.apply(triples, this.inverseBranchPattern.getDirectTriples());

    return triples;
  }

  public getBranchPatterns(): TreeGraphPattern[] {
    let branches: TreeGraphPattern[] = [];
    branches.push.apply(branches, this.branchPattern.getBranchPatterns());
    branches.push.apply(branches, this.inverseBranchPattern.getBranchPatterns());
    return branches;
  }

  public getOptionalPatterns(): TreeGraphPattern[] {
    let patterns = [];
    let addBranch = (property, branch) => {
      let gp = new TreeGraphPattern(this.name());
      gp.branch(property, branch);
      patterns.push(gp);
    };
    let addInverseBranch = (property, branch) => {
      let gp = new TreeGraphPattern(this.name());
      gp.inverseBranch(property, branch);
      patterns.push(gp);
    };
    this.optionalBranchPattern.enumerateBranches(addBranch);
    this.optionalInverseBranchPattern.enumerateBranches(addInverseBranch);
    return patterns;
  }

  public getUnionPatterns(): TreeGraphPattern[] {
    return this.unionPatterns;
  }

  public getConjunctivePatterns(): TreeGraphPattern[] {
    return this.conjunctivePatterns;
  }

  public name(): string {
    return this.rootName;
  }

  public branch(property: string): TreeGraphPattern[];
  public branch(property: string, arg: string | TreeGraphPattern): TreeGraphPattern;
  public branch(property: string, arg: ValueLeaf): void;
  public branch(property: string, arg?): any {
    switch (typeof arg) {
      case "undefined":
      case "object":
        if (arg instanceof ValueLeaf) {
          if (this.valueLeaves[property] !== undefined)
            this.valueLeaves[property].push(arg);
          else
            this.valueLeaves[property] = [ arg as ValueLeaf ];
          return;
        }
        else
          return this.branchPattern.branch(property, arg);
      case "string":
        let pat = new TreeGraphPattern(arg);
        return this.branch(property, pat);
      default:
        throw new Error("branch argument is neither string nor TreeGraphPattern respective ValueLeaf");
    }
  }

  public inverseBranch(property: string): TreeGraphPattern[];
  public inverseBranch(property: string, arg: string | TreeGraphPattern): TreeGraphPattern;
  public inverseBranch(property: string, arg?): any {
    switch (typeof arg) {
      case "undefined":
      case "object":
        return this.inverseBranchPattern.branch(property, arg);
      case "string":
        let pat = new TreeGraphPattern(arg);
        return this.inverseBranchPattern.branch(property, pat);
      default:
        throw new Error("branch argument is neither string nor object");
    }
  }

  public optionalBranch(property: string): TreeGraphPattern[];
  public optionalBranch(property: string, arg: string | TreeGraphPattern): TreeGraphPattern;
  public optionalBranch(property, arg?): any {
    switch (typeof arg) {
      case "undefined":
      case "object":
        return this.optionalBranchPattern.branch(property, arg);
      case "string":
        let pat = new TreeGraphPattern(arg);
        return this.optionalBranchPattern.branch(property, pat);
      default:
        throw new Error("branch argument is neither string nor object");
    }
  }

  public optionalInverseBranch(property: string): TreeGraphPattern[];
  public optionalInverseBranch(property: string, arg: string | TreeGraphPattern): TreeGraphPattern;
  public optionalInverseBranch(property, arg?): any {
    switch (typeof arg) {
      case "undefined":
      case "object":
        return this.optionalInverseBranchPattern.branch(property, arg);
      case "string":
        let pat = new TreeGraphPattern(arg);
        return this.optionalInverseBranchPattern.branch(property, pat);
      default:
        throw new Error("branch argument is neither string nor object");
    }
  }

  public newUnionPattern(pattern?: TreeGraphPattern): TreeGraphPattern {
    pattern = pattern || new TreeGraphPattern(this.name());
    this.unionPatterns.push(pattern);
    return pattern;
  }

  /** Create a graph pattern with independent root variable. Append it with AND, i.e. " . " */
  public newConjunctivePattern(pattern?: TreeGraphPattern): TreeGraphPattern {
    pattern = pattern || new TreeGraphPattern(this.name());
    this.conjunctivePatterns.push(pattern);
    return pattern;
  }

  public branchExists(property: string): boolean {
    return this.branchPattern.branch(property).length > 0;
  }

  public merge(other: TreeGraphPattern): void {
    if (this.rootName !== other.rootName) throw new Error("can\'t merge trees with different roots");
    this.branchPattern.merge(other.branchPattern);
    this.inverseBranchPattern.merge(other.inverseBranchPattern);
    this.optionalBranchPattern.merge(other.optionalBranchPattern);
    /* @todo unions */
  }
}

export class GraphPatternWithBranches {
  private createTriple: (property: string, branch: TreeGraphPattern) => any[];
  private branches: { [id: string]: TreeGraphPattern[] } = {};

  constructor(createTriple: (property: string, branch: TreeGraphPattern) => any[]) {
    this.createTriple = createTriple;
  }

  public branch(property: string): TreeGraphPattern[];
  public branch(property: string, arg: TreeGraphPattern): TreeGraphPattern;
  public branch(property: string, arg?): any {
    switch (typeof arg) {
      case "undefined":
        return this.branches[property] || [];
      case "object":
        if (this.branches[property] !== undefined)
          this.branches[property].push(arg);
        else
          this.branches[property] = [ arg as TreeGraphPattern ];
        return arg;
      default:
        throw new Error("branch argument was specified but is no object");
    }
  }

  public getDirectTriples(): any[][] {
    let triples: any[][] = [];
    this.enumerateBranches((property, branch) => {
        triples.push(this.createTriple(property, branch));
    });
    return triples;
  }

  public getBranchPatterns(): TreeGraphPattern[] {
    let patterns: TreeGraphPattern[] = [];
    this.enumerateBranches((property, branch) => patterns.push(branch));
    return patterns;
  }

  public enumerateBranches(fn: (property: string, branch: TreeGraphPattern) => void) {
    for (let property in this.branches) {
      let branches = this.branches[property];
      branches.forEach(branch => fn(property, branch));
    }
  }

  public merge(other: GraphPatternWithBranches) {
    other.enumerateBranches((property, branch) => {
      this.branch(property, branch);
    });
  }
}

export class ValueLeaf {
  public value: string;

  constructor(value: string) {
    this.value = value;
  }
}
