/** @module */
import _ = require('../util');
import Mappings = require('./sparql_mappings');

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
  private triples: any[][];
  private optionalPatterns: GraphPattern[];
  private unionPatterns: GraphPattern[];

	constructor(triples: any[][]) {
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

    for(var i=0; i<patterns.length; ++i) { this.integratePatternsAsOptional(patterns[i].getOptionalPatterns()) };
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
  private branches: { [id: string]: TreeGraphPattern[] };
  private inverseBranches: { [id: string]: TreeGraphPattern[] };
  private optionalBranches: { [id: string]: TreeGraphPattern[] };
  private unionPatterns: GraphPattern[];

  constructor(rootName: string) {
    this.rootName = rootName;
    this.branches = { };
    this.inverseBranches = { };
    this.optionalBranches = { };
    this.unionPatterns = [ ];
  }

  public getTriples(): any[][] {
    var triples: any[][] = [];
    for(var property in this.branches) {
      var branches = this.branches[property];
      branches.forEach(branch => {
        triples.push([ this.name(), property, branch.name() ]);
        triples.push.apply(triples, branch.getTriples());
      });
    }
    var unions = this.getUnionPatterns();
    return triples;
  }

  public getOptionalPatterns(): GraphPattern[] {
    var self = this;
    var patterns = [];
    for(var property in this.optionalBranches) {
      var branches = this.optionalBranches[property];
      branches.forEach(branch => {
        var gp = new ComposibleGraphPattern([[ self.name(), property, branch.name() ]]);
        gp.integratePatterns([ branch ]);
        patterns.push(gp);
      })
    }
    var unions = this.getUnionPatterns();
    return patterns;
  }

  public getUnionPatterns(): GraphPattern[] {
    return this.unionPatterns;
  }

  public name(): string {
    return this.rootName;
  }

  public branch(property: string, arg: void): TreeGraphPattern[];
  public branch(property: string, arg: string): TreeGraphPattern;
  public branch(property: string, arg: TreeGraphPattern): TreeGraphPattern;
  public branch(property: string, arg) {
    switch(typeof arg) {
      case 'undefined': return this.branches[property];
      case 'string':
        var pat = new TreeGraphPattern(arg);
        return this.branch(property, pat);
      case 'object':
        if(this.branches[property] !== undefined)
          this.branches[property].push(arg);
        else
          this.branches[property] = [ arg ];
        return arg;
    }
  }

  public inverseBranch(property: string, arg: void): TreeGraphPattern[];
  public inverseBranch(property: string, arg: string): TreeGraphPattern;
  public inverseBranch(property: string, arg: TreeGraphPattern): TreeGraphPattern;
  public inverseBranch(property: string, arg) {
    switch(typeof arg) {
      case 'undefined': return this.inverseBranches[property];
      case 'string':
        var pat = new TreeGraphPattern(arg);
        return this.inverseBranch(property, pat);
      case 'object':
        if(this.inverseBranches[property] !== undefined)
          this.inverseBranches[property].push(arg);
        else
          this.inverseBranches[property] = [ arg ];
        return arg;
    }
  }

  public optionalBranch(property: string, arg: void): TreeGraphPattern[];
  public optionalBranch(property: string, arg: string): TreeGraphPattern;
  public optionalBranch(property: string, arg: TreeGraphPattern): TreeGraphPattern;
  public optionalBranch(property, arg) {
    switch(typeof arg) {
      case 'undefined': return this.optionalBranches[property];
      case 'string':
        var pat = new TreeGraphPattern(arg);
        return this.optionalBranch(property, pat);
      case 'object':
        if(this.optionalBranches[property] !== undefined)
          this.optionalBranches[property].push(arg);
        else
          this.optionalBranches[property] = [ arg ];
        return arg;
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
    if(this.rootName !== other.rootName) throw new Error('can\'t merge trees with different roots');
    for(var property in other.branches) {
      other.branches[property].forEach(branch => {
        this.branch(property, branch);
      })
    }
    for(var property in other.optionalBranches) {
      other.optionalBranches[property].forEach(branch => {
        this.optionalBranch(property, branch);
      })
    }
  }
}

/**
 * Provides a SPARQL graph pattern involving all the direct and elementary
 * properties belonging to the OData entity type passed as schema.
 */
export class DirectPropertiesGraphPattern extends TreeGraphPattern {
	constructor(entityType, mapping: Mappings.StructuredSparqlVariableMapping) {
    var entityVariable: string = mapping.getVariable();
    super(entityVariable);

    var propertyNames = entityType.getPropertyNames();
    var properties = propertyNames.map(p => entityType.getProperty(p));
    for(var i in properties) {
      var property = properties[i];
      var propertyName = property.getName();
      if(property.isNavigationProperty() === false) {
        if(!property.mirroredFromProperty()) {
          //TODO: optional
          this.branch(property.getNamespacedUri(), mapping.getElementaryPropertyVariable(propertyName));
        }
        else {
          var mirroringProperty = property.mirroredFromProperty();
          var propertyValueVar = mapping.getComplexProperty(mirroringProperty.getName()).getVariable();
          if(mirroringProperty.isOptional() == false) {
            this
              .branch(mirroringProperty.getNamespacedUri(), propertyValueVar)
              .branch('disco:id', mapping.getElementaryPropertyVariable(propertyName));
          }
          else {
            this
              .optionalBranch(mirroringProperty.getNamespacedUri(), propertyValueVar)
              .branch('disco:id', mapping.getElementaryPropertyVariable(propertyName));
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

    var directPropertyPattern = new DirectPropertiesGraphPattern(entityType, mapping);
    var nestedPatterns = Object.keys(expandTree)
    .forEach(propertyName => {
      var property = entityType.getProperty(propertyName);
      var propertyType = property.getEntityType();
      //Next recursion level
      var gp = new ExpandTreeGraphPattern(propertyType, expandTree[propertyName], mapping.getComplexProperty(propertyName));
      if(!property.hasDirectRdfRepresentation()) {
        var inverseProperty = property.getInverseProperty();
        var unionPattern = this.newUnionPattern();
        unionPattern.inverseBranch(inverseProperty.getNamespacedUri(), gp);
      }
      else if(!property.isQuantityOne()) {
        this.newUnionPattern().branch(property.getNamespacedUri(), gp);
      }
      else if(property.isOptional()) {
        directPropertyPattern.optionalBranch(property.getNamespacedUri(), gp);
      }
      else {
        directPropertyPattern.branch(property.getNamespacedUri(), gp);
      }
    });

  this.newUnionPattern(directPropertyPattern);
  }
}