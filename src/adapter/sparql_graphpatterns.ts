/** @module */
import _ = require("../util");
import Mappings = require("./sparql_mappings");

/**
 * Provides a SPARQL graph pattern consisting of mandatory and optional triples.
 */
export interface GraphPattern {
  getTriples(): Array<Array<any>>;
  getOptionalPatterns(): Array<GraphPattern>;
  getUnionPatterns(): Array<GraphPattern>;
}

/**
 * Provides a SPARQL graph pattern whose triples are directly composible
 * and manipulatable.
 */
export class ComposibleGraphPattern implements GraphPattern {
  public triples: any[][];
  public optionalPatterns: GraphPattern[];
  public unionPatterns: GraphPattern[];

  constructor(triples?: any[][]) {
    this.triples = triples || [];
    this.optionalPatterns = [];
    this.unionPatterns = []; /** @todo consider unionPatterns */
  }

  public getTriples(): any[][] {
    return this.triples;
  }

  public getOptionalPatterns(): GraphPattern[] {
    return this.optionalPatterns;
  }

  public getUnionPatterns(): GraphPattern[] {
    return this.unionPatterns;
  }

  public integratePatterns(patterns: GraphPattern[]) {
    this.triples = _.mergeArrays(
      [this.triples].concat(patterns.map(p => p.getTriples()))
    );

    for (let i = 0; i < patterns.length; ++i) { this.integratePatternsAsOptional(patterns[i].getOptionalPatterns()); };
  }

  public integratePatternsAsOptional(patterns: GraphPattern[]) {
    this.optionalPatterns.push.apply(this.optionalPatterns, patterns);
  }
}

/**
 * Provides a SPARQL graph pattern whose triples are generated from a
 * property tree
 */
export class TreeGraphPattern implements GraphPattern {
  private rootName: string;
  private branches: { [id: string]: TreeGraphPattern[] } = { };
  private valueLeaves: { [id: string]: ValueLeaf[] } = { };
  private inverseBranches: { [id: string]: TreeGraphPattern[] } = { };
  private optionalBranches: { [id: string]: TreeGraphPattern[] } = { };
  private unionPatterns: TreeGraphPattern[] = [ ];

  constructor(rootName: string) {
    this.rootName = rootName;
  }

  public getTriples(): any[][] {
    let triples: any[][] = [];
    for (let property in this.valueLeaves) {
      let leaves = this.valueLeaves[property];
      leaves.forEach(leaf => {
        triples.push([ this.name(), property, "\"" + leaf.value + "\"" ]);
      });
    }
    for (let property in this.branches) {
      let branches = this.branches[property];
      branches.forEach(branch => {
        triples.push([ this.name(), property, branch.name() ]);
        triples.push.apply(triples, branch.getTriples());
      });
    }
    for (let property in this.inverseBranches) {
      let branches = this.inverseBranches[property];
      branches.forEach(branch => {
        triples.push([ branch.name(), property, this.name() ]);
        triples.push.apply(triples, branch.getTriples());
      });
    }
    return triples;
  }

  public getOptionalPatterns(): GraphPattern[] {
    let self = this;
    let patterns = [];
    for (let property in this.optionalBranches) {
      let branches = this.optionalBranches[property];
      branches.forEach(branch => {
        let gp = new ComposibleGraphPattern([[ self.name(), property, branch.name() ]]);
        gp.integratePatterns([ branch ]);
        patterns.push(gp);
      });
    }
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
  public branch(property: string, arg?) {
    switch (typeof arg) {
      case "undefined": return this.branches[property];
      case "string":
        let pat = new TreeGraphPattern(arg);
        return this.branch(property, pat);
      case "object":
        if (arg instanceof TreeGraphPattern) {
          if (this.branches[property] !== undefined)
            this.branches[property].push(arg);
          else
            this.branches[property] = [ arg as TreeGraphPattern ];
          return arg;
        }
        else if (arg instanceof ValueLeaf) {
          if (this.valueLeaves[property] !== undefined)
            this.valueLeaves[property].push(arg);
          else
            this.valueLeaves[property] = [ arg as ValueLeaf ];
          return;
        }
      default:
        throw new Error("branch argument is neither string nor TreeGraphPattern respective ValueLeaf");
    }
  }

  public inverseBranch(property: string): TreeGraphPattern[];
  public inverseBranch(property: string, arg: string): TreeGraphPattern;
  public inverseBranch(property: string, arg: TreeGraphPattern): TreeGraphPattern;
  public inverseBranch(property: string, arg?) {
    switch (typeof arg) {
      case "undefined": return this.inverseBranches[property];
      case "string":
        let pat = new TreeGraphPattern(arg);
        return this.inverseBranch(property, pat);
      case "object":
        if (this.inverseBranches[property] !== undefined)
          this.inverseBranches[property].push(arg);
        else
          this.inverseBranches[property] = [ arg ];
        return arg;
      default:
        throw new Error("branch argument is neither string nor object");
    }
  }

  public optionalBranch(property: string): TreeGraphPattern[];
  public optionalBranch(property: string, arg: string): TreeGraphPattern;
  public optionalBranch(property: string, arg: TreeGraphPattern): TreeGraphPattern;
  public optionalBranch(property, arg?) {
    switch (typeof arg) {
      case "undefined": return this.optionalBranches[property];
      case "string":
        let pat = new TreeGraphPattern(arg);
        return this.optionalBranch(property, pat);
      case "object":
        if (this.optionalBranches[property] !== undefined)
          this.optionalBranches[property].push(arg);
        else
          this.optionalBranches[property] = [ arg ];
        return arg;
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
    return this.branches[property] !== undefined;
  }

  public merge(other: TreeGraphPattern): void {
    if (this.rootName !== other.rootName) throw new Error("can\'t merge trees with different roots");
    for (let property in other.branches) {
      other.branches[property].forEach(branch => {
        this.branch(property, branch);
      });
    }
    for (let property in other.optionalBranches) {
      other.optionalBranches[property].forEach(branch => {
        this.optionalBranch(property, branch);
      });
    }
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
 */
export class DirectPropertiesGraphPattern extends TreeGraphPattern {
  constructor(entityType, mapping: Mappings.StructuredSparqlVariableMapping) {
    let entityVariable: string = mapping.getVariable();
    super(entityVariable);

    let propertyNames = entityType.getPropertyNames();
    let properties = propertyNames.map(p => entityType.getProperty(p));
    for (let i in properties) {
      let property = properties[i];
      let propertyName = property.getName();
      if (property.isNavigationProperty() === false) {
        if (!property.mirroredFromProperty()) {
          // TODO: optional
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
  constructor(entityType, expandTree, mapping: Mappings.StructuredSparqlVariableMapping) {
    super(mapping.getVariable());

    let directPropertyPattern = new DirectPropertiesGraphPattern(entityType, mapping);
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
      }
      else if (!property.isQuantityOne()) {
        this.newUnionPattern().branch(property.getNamespacedUri(), gp);
      }
      else if (property.isOptional()) {
        directPropertyPattern.optionalBranch(property.getNamespacedUri(), gp);
      }
      else {
        directPropertyPattern.branch(property.getNamespacedUri(), gp);
      }
    });

    this.newUnionPattern(directPropertyPattern);
  }
}
