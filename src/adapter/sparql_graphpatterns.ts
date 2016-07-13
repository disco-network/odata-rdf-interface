/** @module */
import Mappings = require("./sparql_mappings");
import Schema = require("../odata/schema");

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

/**
 * Provides a SPARQL graph pattern whose triples are generated from a
 * property tree
 */
export class TreeGraphPattern {
  private rootName: string;
  private branchPattern: GraphPatternWithBranches;
  private inverseBranchPattern: GraphPatternWithBranches;
  private optionalBranchPattern: GraphPatternWithBranches;

  private valueLeaves: { [id: string]: ValueLeaf[] } = { };
  private unionPatterns: TreeGraphPattern[] = [ ];

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
    this.optionalBranchPattern.enumerateBranches((property, branch) => {
      let gp = new TreeGraphPattern(this.name());
      gp.branch(property, branch);
      patterns.push(gp);
    });
    return patterns;
  }

  public getUnionPatterns(): TreeGraphPattern[] {
    return this.unionPatterns;
  }

  public name(): string {
    return this.rootName;
  }

  public branch(property: string): TreeGraphPattern[];
  public branch(property: string, arg: string): TreeGraphPattern;
  public branch(property: string, arg: TreeGraphPattern): TreeGraphPattern;
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
  public inverseBranch(property: string, arg: string): TreeGraphPattern;
  public inverseBranch(property: string, arg: TreeGraphPattern): TreeGraphPattern;
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
  public optionalBranch(property: string, arg: string): TreeGraphPattern;
  public optionalBranch(property: string, arg: TreeGraphPattern): TreeGraphPattern;
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

  public newUnionPattern(pattern?: TreeGraphPattern): TreeGraphPattern {
    pattern = pattern || new TreeGraphPattern(this.name());
    this.unionPatterns.push(pattern);
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

export class ValueLeaf {
  public value: string;

  constructor(value: string) {
    this.value = value;
  }
}

/**
 * Provides a SPARQL graph pattern involving all the direct and elementary
 * properties belonging to the OData entity type passed as schema.
 * Please separate the options like this: "no-id-property|some-other-option"
 */
export class DirectPropertiesGraphPattern extends TreeGraphPattern {
  constructor(entityType: Schema.EntityType, mapping: Mappings.StructuredSparqlVariableMapping, options: string) {
    let entityVariable: string = mapping.getVariable();
    super(entityVariable);

    let propertyNames = entityType.getPropertyNames();
    let properties = propertyNames.map(p => entityType.getProperty(p));

    for (let i = 0; i < properties.length; ++i) {
      let property = properties[i];
      let propertyName = property.getName();
      if (propertyName === "Id" && options.indexOf("no-id-property") >= 0) continue;
      if (property.isNavigationProperty() === false) {
        if (!property.mirroredFromProperty()) {
          /* @todo optional */
          this.branch(property.getNamespacedUri(), mapping.getElementaryPropertyVariable(propertyName));
        }
        else {
          let mirroringProperty = property.mirroredFromProperty();
          let propertyValueVar = mapping.getComplexProperty(mirroringProperty.getName()).getVariable();
          if (mirroringProperty.isOptional() === false) {
            this
              .branch(mirroringProperty.getNamespacedUri(), propertyValueVar)
              .branch("disco:id", mapping.getElementaryPropertyVariable(propertyName));
          }
          else {
            this
              .optionalBranch(mirroringProperty.getNamespacedUri(), propertyValueVar)
              .branch("disco:id", mapping.getElementaryPropertyVariable(propertyName));
          }
        }
      }
    }
  }
}

/**
 * Provides a SPARQL graph pattern according to an entity type schema,
 * an expand tree and a StructuredSparqlVariableMapping so that it contains
 * all the data necessary for an OData $expand query.
 */
export class ExpandTreeGraphPattern extends TreeGraphPattern {
  constructor(entityType: Schema.EntityType, expandTree, mapping: Mappings.StructuredSparqlVariableMapping) {
    super(mapping.getVariable());

    this.branch(entityType.getProperty("Id").getNamespacedUri(), mapping.getElementaryPropertyVariable("Id"));

    let directPropertyPattern = new DirectPropertiesGraphPattern(entityType, mapping, "no-id-property");
    this.newUnionPattern(directPropertyPattern);
    Object.keys(expandTree).forEach(propertyName => {
      let property = entityType.getProperty(propertyName);
      let propertyType = property.getEntityType();
      // Next recursion level
      let gp = new ExpandTreeGraphPattern(propertyType, expandTree[propertyName],
        mapping.getComplexProperty(propertyName));

      if (!property.hasDirectRdfRepresentation()) {

        let inverseProperty = property.getInverseProperty();
        let unionPattern = this.newUnionPattern();
        unionPattern.inverseBranch(inverseProperty.getNamespacedUri(), gp);

      } else {

        this.newUnionPattern().branch(property.getNamespacedUri(), gp);
      }
    });
  }
}
