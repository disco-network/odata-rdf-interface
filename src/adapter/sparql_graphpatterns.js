"use strict";
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
/** @module */
var _ = require('../util');
/**
 * Provides a SPARQL graph pattern whose triples are directly composible
 * and manipulatable.
 */
var ComposibleGraphPattern = (function () {
    function ComposibleGraphPattern(triples) {
        this.triples = triples || [];
        this.optionalPatterns = [];
        this.unionPatterns = []; /** @todo consider unionPatterns */
    }
    ComposibleGraphPattern.prototype.getTriples = function () {
        return this.triples;
    };
    ComposibleGraphPattern.prototype.getOptionalPatterns = function () {
        return this.optionalPatterns;
    };
    ComposibleGraphPattern.prototype.getUnionPatterns = function () {
        return this.unionPatterns;
    };
    ComposibleGraphPattern.prototype.integratePatterns = function (patterns) {
        this.triples = _.mergeArrays([this.triples].concat(patterns.map(function (p) { return p.getTriples(); })));
        for (var i = 0; i < patterns.length; ++i) {
            this.integratePatternsAsOptional(patterns[i].getOptionalPatterns());
        }
        ;
    };
    ComposibleGraphPattern.prototype.integratePatternsAsOptional = function (patterns) {
        this.optionalPatterns.push.apply(this.optionalPatterns, patterns);
    };
    return ComposibleGraphPattern;
}());
exports.ComposibleGraphPattern = ComposibleGraphPattern;
/**
 * Provides a SPARQL graph pattern whose triples are generated from a
 * property tree
 */
var TreeGraphPattern = (function () {
    function TreeGraphPattern(rootName) {
        this.rootName = rootName;
        this.branches = {};
        this.inverseBranches = {};
        this.optionalBranches = {};
        this.unionPatterns = [];
    }
    TreeGraphPattern.prototype.getTriples = function () {
        var _this = this;
        var triples = [];
        for (var property in this.branches) {
            var branches = this.branches[property];
            branches.forEach(function (branch) {
                triples.push([_this.name(), property, branch.name()]);
                triples.push.apply(triples, branch.getTriples());
            });
        }
        var unions = this.getUnionPatterns();
        return triples;
    };
    TreeGraphPattern.prototype.getOptionalPatterns = function () {
        var self = this;
        var patterns = [];
        for (var property in this.optionalBranches) {
            var branches = this.optionalBranches[property];
            branches.forEach(function (branch) {
                var gp = new ComposibleGraphPattern([[self.name(), property, branch.name()]]);
                gp.integratePatterns([branch]);
                patterns.push(gp);
            });
        }
        var unions = this.getUnionPatterns();
        return patterns;
    };
    TreeGraphPattern.prototype.getUnionPatterns = function () {
        return this.unionPatterns;
    };
    TreeGraphPattern.prototype.name = function () {
        return this.rootName;
    };
    TreeGraphPattern.prototype.branch = function (property, arg) {
        switch (typeof arg) {
            case 'undefined': return this.branches[property];
            case 'string':
                var pat = new TreeGraphPattern(arg);
                return this.branch(property, pat);
            case 'object':
                if (this.branches[property] !== undefined)
                    this.branches[property].push(arg);
                else
                    this.branches[property] = [arg];
                return arg;
        }
    };
    TreeGraphPattern.prototype.inverseBranch = function (property, arg) {
        switch (typeof arg) {
            case 'undefined': return this.inverseBranches[property];
            case 'string':
                var pat = new TreeGraphPattern(arg);
                return this.inverseBranch(property, pat);
            case 'object':
                if (this.inverseBranches[property] !== undefined)
                    this.inverseBranches[property].push(arg);
                else
                    this.inverseBranches[property] = [arg];
                return arg;
        }
    };
    TreeGraphPattern.prototype.optionalBranch = function (property, arg) {
        switch (typeof arg) {
            case 'undefined': return this.optionalBranches[property];
            case 'string':
                var pat = new TreeGraphPattern(arg);
                return this.optionalBranch(property, pat);
            case 'object':
                if (this.optionalBranches[property] !== undefined)
                    this.optionalBranches[property].push(arg);
                else
                    this.optionalBranches[property] = [arg];
                return arg;
        }
    };
    TreeGraphPattern.prototype.newUnionPattern = function (pattern) {
        pattern = pattern || new TreeGraphPattern(this.name());
        this.unionPatterns.push(pattern);
        return pattern;
    };
    TreeGraphPattern.prototype.branchExists = function (property) {
        return this.branches[property] !== undefined;
    };
    TreeGraphPattern.prototype.merge = function (other) {
        var _this = this;
        if (this.rootName !== other.rootName)
            throw new Error('can\'t merge trees with different roots');
        for (var property in other.branches) {
            other.branches[property].forEach(function (branch) {
                _this.branch(property, branch);
            });
        }
        for (var property in other.optionalBranches) {
            other.optionalBranches[property].forEach(function (branch) {
                _this.optionalBranch(property, branch);
            });
        }
    };
    return TreeGraphPattern;
}());
exports.TreeGraphPattern = TreeGraphPattern;
/**
 * Provides a SPARQL graph pattern involving all the direct and elementary
 * properties belonging to the OData entity type passed as schema.
 */
var DirectPropertiesGraphPattern = (function (_super) {
    __extends(DirectPropertiesGraphPattern, _super);
    function DirectPropertiesGraphPattern(entityType, mapping) {
        var entityVariable = mapping.getVariable();
        _super.call(this, entityVariable);
        var propertyNames = entityType.getPropertyNames();
        var properties = propertyNames.map(function (p) { return entityType.getProperty(p); });
        for (var i in properties) {
            var property = properties[i];
            var propertyName = property.getName();
            if (property.isNavigationProperty() === false) {
                if (!property.mirroredFromProperty()) {
                    //TODO: optional
                    this.branch(property.getNamespacedUri(), mapping.getElementaryPropertyVariable(propertyName));
                }
                else {
                    var mirroringProperty = property.mirroredFromProperty();
                    var propertyValueVar = mapping.getComplexProperty(mirroringProperty.getName()).getVariable();
                    if (mirroringProperty.isOptional() == false) {
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
    return DirectPropertiesGraphPattern;
}(TreeGraphPattern));
exports.DirectPropertiesGraphPattern = DirectPropertiesGraphPattern;
/**
 * Provides a SPARQL graph pattern according to an entity type schema,
 * an expand tree and a StructuredSparqlVariableMapping so that it contains
 * all the data necessary for an OData $expand query.
 */
var ExpandTreeGraphPattern = (function (_super) {
    __extends(ExpandTreeGraphPattern, _super);
    function ExpandTreeGraphPattern(entityType, expandTree, mapping) {
        var _this = this;
        _super.call(this, mapping.getVariable());
        var directPropertyPattern = new DirectPropertiesGraphPattern(entityType, mapping);
        var nestedPatterns = Object.keys(expandTree)
            .forEach(function (propertyName) {
            var property = entityType.getProperty(propertyName);
            var propertyType = property.getEntityType();
            //Next recursion level
            var gp = new ExpandTreeGraphPattern(propertyType, expandTree[propertyName], mapping.getComplexProperty(propertyName));
            if (!property.hasDirectRdfRepresentation()) {
                var inverseProperty = property.getInverseProperty();
                var unionPattern = _this.newUnionPattern();
                unionPattern.inverseBranch(inverseProperty.getNamespacedUri(), gp);
            }
            else if (!property.isQuantityOne()) {
                _this.newUnionPattern().branch(property.getNamespacedUri(), gp);
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
    return ExpandTreeGraphPattern;
}(TreeGraphPattern));
exports.ExpandTreeGraphPattern = ExpandTreeGraphPattern;
