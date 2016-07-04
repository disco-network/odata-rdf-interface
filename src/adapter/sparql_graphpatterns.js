/** @module */
module.exports = { };
var _ = require('../util');

/**
 * @class
 * Provides a SPARQL graph pattern consisting of mandatory and optional triples.
 */
var GraphPattern = module.exports.GraphPattern = _.defClass(null,
function() {
},
{
  getTriples: _.notImplemented,
  getOptionalPatterns: _.notImplemented,
  getUnionPatterns: _.notImplemented,
});

/**
 * @class
 * Provides a SPARQL graph pattern whose triples are directly composible
 * and manipulatable.
 */
var ComposibleGraphPattern = module.exports.ComposibleGraphPattern = _.defClass(GraphPattern,
function ComposibleGraphPattern(triples) {
  this.triples = triples || [];
  this.optionalPatterns = [];
  this.unionPatterns = []; /** @construction */
},
{
  getTriples: function() {
    return this.triples;
  },
  getOptionalPatterns: function() {
    return this.optionalPatterns;
  },
  integratePatterns: function(patterns) {
    this.triples = _.mergeArrays([this.triples].concat(patterns
    .map(function(p) {
      return p.getTriples()
    })));

    for(var i in patterns) { this.integratePatternsAsOptional(patterns[i].getOptionalPatterns()) };
  },
  integratePatternsAsOptional: function(patterns) {
    this.optionalPatterns.push.apply(this.optionalPatterns, patterns);
  }
});

/**
 * @class
 * Provides a SPARQL graph pattern whose triples are generated from a
 * property tree
 */
var TreeGraphPattern = module.exports.TreeGraphPattern = _.defClass(GraphPattern,
function TreeGraphPattern(rootName) {
  this.rootName = rootName;
  this.branches = { };
  this.inverseBranches = { };
  this.optionalBranches = { };
  this.unionPatterns = [ ];
},
{
  getTriples: function(optimize) {
    var self = this;
    var triples = [];
    for(var property in this.branches) {
      var branches = this.branches[property];
      branches.forEach(function(branch) {
        triples.push([ self.name(), property, branch.name() ]);
        triples.push.apply(triples, branch.getTriples(optimize));
      });
    }
    var unions = this.getUnionPatterns(false);
    if(optimize === true && unions.length === 1) triples.push.apply(triples, unions[0].getTriples(true));
    return triples;
  },
  getOptionalPatterns: function(optimize) {
    var self = this;
    var patterns = [];
    for(var property in this.optionalBranches) {
      var branches = this.optionalBranches[property];
      branches.forEach(function(branch) {
        var gp = new ComposibleGraphPattern([[ self.name(), property, branch.name() ]]);
        gp.integratePatterns([ branch ]);
        patterns.push(gp);
      })
    }
    var unions = this.getUnionPatterns(false);
    if(optimize === true && unions.length === 1) patterns.push.apply(patterns, unions[0].getOptionalPatterns(true));
    return patterns;
  },
  getUnionPatterns: function(optimize) {
    if(optimize === true && this.unionPatterns.length === 1) return this.unionPatterns[0].getUnionPatterns(true);
    return this.unionPatterns;
  },
  name: function() {
    return this.rootName;
  },
  branch: function(property, arg) {
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
  },
  inverseBranch: function(property, arg) {
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
  },
  optionalBranch: function(property, arg) {
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
  },
  newUnionPattern: function(pattern) {
    pattern = pattern || new TreeGraphPattern(this.name());
    this.unionPatterns.push(pattern);
    return pattern;
  },
  branchExists: function(property) {
    return this.branches[property] !== undefined;
  },
  merge: function(other) {
    var self = this;
    if(this.rootName !== other.rootName) throw new Error('can\'t merge trees with different roots');
    for(var property in other.branches) {
      other.branches[property].forEach(function(branch) {
        self.branch(property, branch);
      })
    }
    for(var property in other.optionalBranches) {
      other.optionalBranches[property].forEach(function(branch) {
        self.optionalBranch(property, branch);
      })
    }
  }
})

/**
 * @class
 * Provides a SPARQL graph pattern involving all the direct and elementary
 * properties belonging to the OData entity type passed as schema.
 */
var DirectPropertiesGraphPattern = module.exports.DirectPropertiesGraphPattern = _.defClass(TreeGraphPattern,
function(entityType, mapping) {
  var entityVariable = mapping.getVariable();
  TreeGraphPattern.call(this, entityVariable);

  var propertyNames = entityType.getPropertyNames();
  var properties = propertyNames.map(function(p) { return entityType.getProperty(p) });
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
},
{
});

/**
 * @class
 * Provides a SPARQL graph pattern according to an entity type schema,
 * an expand tree and a StructuredSparqlVariableMapping so that it contains
 * all the data necessary for an OData $expand query.
 */
var ExpandTreeGraphPattern = module.exports.ExpandTreeGraphPattern = _.defClass(TreeGraphPattern,
function ExpandTreeGraphPattern(entityType, expandTree, mapping) {
  var self = this;
  TreeGraphPattern.call(this, mapping.getVariable());

  var directPropertyPattern = new DirectPropertiesGraphPattern(entityType, mapping);
  var nestedPatterns = Object.keys(expandTree)
  .forEach(function(propertyName) {
    var property = entityType.getProperty(propertyName);
    var propertyType = property.getEntityType();
    //Next recursion level
    var gp = new ExpandTreeGraphPattern(propertyType, expandTree[propertyName], mapping.getComplexProperty(propertyName));
    if(!property.hasDirectRdfRepresentation()) {
      var inverseProperty = property.getInverseProperty();
      var unionPattern = self.newUnionPattern();
      unionPattern.inverseBranch(inverseProperty.getNamespacedUri(), gp);
    }
    else if(!property.isQuantityOne()) {
      self.newUnionPattern().branch(property.getNamespacedUri(), gp);
    }
    else if(property.isOptional()) {
      directPropertyPattern.optionalBranch(property.getNamespacedUri(), gp);
    }
    else {
      directPropertyPattern.branch(property.getNamespacedUri(), gp);
    }
  });

  //this.merge(directPropertyPattern);
  this.newUnionPattern(directPropertyPattern);
  //console.log(this);
},
{
});

/** @todo do we still need this class? */
var ExpandedPropertyGraphPattern = module.exports.ExpandedPropertyGraphPattern = _.defClass(TreeGraphPattern,
function ExpandedPropertyGraphPattern(entityType, propertyName, mapping) {
  var entityVariable = mapping.getVariable();
  TreeGraphPattern.call(this, entityVariable);

  var propertySchema = entityType.getProperty(propertyName);
  var propertyType = propertySchema.getEntityType();
  var propertyMapping = mapping.getComplexProperty(propertyName);

  var secondOrderProperties = new DirectPropertiesGraphPattern(propertyType, propertyMapping, propertyName);

  var mainTriple = [ entityVariable, propertySchema.getNamespacedUri(), propertyMapping.getVariable() ];
  if(propertySchema.isOptional() == false) {
    this.branch(propertySchema.getNamespacedUri(), secondOrderProperties);
  }
  else {
    this.optionalBranch(propertySchema.getNamespacedUri(), secondOrderProperties);
  }
},
{
});
