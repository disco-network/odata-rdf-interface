"use strict";
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
/*export class BranchedGraphPattern implements GraphPattern {

}*/
/**
 * Provides a SPARQL graph pattern whose triples are generated from a
 * property tree
 */
var TreeGraphPattern = (function () {
    function TreeGraphPattern(rootName) {
        this.branches = {};
        this.valueLeaves = {};
        this.inverseBranches = {};
        this.optionalBranches = {};
        this.unionPatterns = [];
        this.rootName = rootName;
    }
    TreeGraphPattern.prototype.getTriples = function () {
        var _this = this;
        var triples = [];
        var _loop_1 = function(property) {
            var leaves = this_1.valueLeaves[property];
            leaves.forEach(function (leaf) {
                triples.push([_this.name(), property, "\"" + leaf.value + "\""]);
            });
        };
        var this_1 = this;
        for (var property in this.valueLeaves) {
            _loop_1(property);
        }
        var _loop_2 = function(property) {
            var branches = this_2.branches[property];
            branches.forEach(function (branch) {
                triples.push([_this.name(), property, branch.name()]);
                triples.push.apply(triples, branch.getTriples());
            });
        };
        var this_2 = this;
        for (var property in this.branches) {
            _loop_2(property);
        }
        var _loop_3 = function(property) {
            var branches = this_3.inverseBranches[property];
            branches.forEach(function (branch) {
                triples.push([branch.name(), property, _this.name()]);
                triples.push.apply(triples, branch.getTriples());
            });
        };
        var this_3 = this;
        for (var property in this.inverseBranches) {
            _loop_3(property);
        }
        return triples;
    };
    TreeGraphPattern.prototype.getDirectTriples = function () {
        var _this = this;
        var triples = [];
        var _loop_4 = function(property) {
            var leaves = this_4.valueLeaves[property];
            leaves.forEach(function (leaf) {
                triples.push([_this.name(), property, "\"" + leaf.value + "\""]);
            });
        };
        var this_4 = this;
        for (var property in this.valueLeaves) {
            _loop_4(property);
        }
        var _loop_5 = function(property) {
            var branches = this_5.branches[property];
            branches.forEach(function (branch) {
                triples.push([_this.name(), property, branch.name()]);
            });
        };
        var this_5 = this;
        for (var property in this.branches) {
            _loop_5(property);
        }
        var _loop_6 = function(property) {
            var branches = this_6.inverseBranches[property];
            branches.forEach(function (branch) {
                triples.push([branch.name(), property, _this.name()]);
            });
        };
        var this_6 = this;
        for (var property in this.inverseBranches) {
            _loop_6(property);
        }
        return triples;
    };
    TreeGraphPattern.prototype.getBranchPatterns = function () {
        var branches = [];
        for (var property in this.branches) {
            branches.push.apply(branches, this.branches[property]);
        }
        for (var property in this.inverseBranches) {
            branches.push.apply(branches, this.branches[property]);
        }
        return branches;
    };
    TreeGraphPattern.prototype.getOptionalPatterns = function () {
        var _this = this;
        var patterns = [];
        var _loop_7 = function(property) {
            var branches = this_7.optionalBranches[property];
            branches.forEach(function (branch) {
                var gp = new TreeGraphPattern(_this.name());
                gp.branch(property, branch);
                patterns.push(gp);
            });
        };
        var this_7 = this;
        for (var property in this.optionalBranches) {
            _loop_7(property);
        }
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
            case "undefined": return this.branches[property];
            case "string":
                var pat = new TreeGraphPattern(arg);
                return this.branch(property, pat);
            case "object":
                if (arg instanceof TreeGraphPattern) {
                    if (this.branches[property] !== undefined)
                        this.branches[property].push(arg);
                    else
                        this.branches[property] = [arg];
                    return arg;
                }
                else if (arg instanceof ValueLeaf) {
                    if (this.valueLeaves[property] !== undefined)
                        this.valueLeaves[property].push(arg);
                    else
                        this.valueLeaves[property] = [arg];
                    return;
                }
            default:
                throw new Error("branch argument is neither string nor TreeGraphPattern respective ValueLeaf");
        }
    };
    TreeGraphPattern.prototype.inverseBranch = function (property, arg) {
        switch (typeof arg) {
            case "undefined": return this.inverseBranches[property];
            case "string":
                var pat = new TreeGraphPattern(arg);
                return this.inverseBranch(property, pat);
            case "object":
                if (this.inverseBranches[property] !== undefined)
                    this.inverseBranches[property].push(arg);
                else
                    this.inverseBranches[property] = [arg];
                return arg;
            default:
                throw new Error("branch argument is neither string nor object");
        }
    };
    TreeGraphPattern.prototype.optionalBranch = function (property, arg) {
        switch (typeof arg) {
            case "undefined": return this.optionalBranches[property];
            case "string":
                var pat = new TreeGraphPattern(arg);
                return this.optionalBranch(property, pat);
            case "object":
                if (this.optionalBranches[property] !== undefined)
                    this.optionalBranches[property].push(arg);
                else
                    this.optionalBranches[property] = [arg];
                return arg;
            default:
                throw new Error("branch argument is neither string nor object");
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
            throw new Error("can\'t merge trees with different roots");
        var _loop_8 = function(property) {
            other.branches[property].forEach(function (branch) {
                _this.branch(property, branch);
            });
        };
        for (var property in other.branches) {
            _loop_8(property);
        }
        var _loop_9 = function(property) {
            other.optionalBranches[property].forEach(function (branch) {
                _this.optionalBranch(property, branch);
            });
        };
        for (var property in other.optionalBranches) {
            _loop_9(property);
        }
    };
    return TreeGraphPattern;
}());
exports.TreeGraphPattern = TreeGraphPattern;
var ValueLeaf = (function () {
    function ValueLeaf(value) {
        this.value = value;
    }
    return ValueLeaf;
}());
exports.ValueLeaf = ValueLeaf;
/**
 * Provides a SPARQL graph pattern involving all the direct and elementary
 * properties belonging to the OData entity type passed as schema.
 * Please separate the options like this: "no-id-property|some-other-option"
 */
var DirectPropertiesGraphPattern = (function (_super) {
    __extends(DirectPropertiesGraphPattern, _super);
    function DirectPropertiesGraphPattern(entityType, mapping, options) {
        var entityVariable = mapping.getVariable();
        _super.call(this, entityVariable);
        var propertyNames = entityType.getPropertyNames();
        var properties = propertyNames.map(function (p) { return entityType.getProperty(p); });
        for (var i = 0; i < properties.length; ++i) {
            var property = properties[i];
            var propertyName = property.getName();
            if (propertyName === "Id" && options.indexOf("no-id-property") >= 0)
                continue;
            if (property.isNavigationProperty() === false) {
                if (!property.mirroredFromProperty()) {
                    // TODO: optional
                    this.branch(property.getNamespacedUri(), mapping.getElementaryPropertyVariable(propertyName));
                }
                else {
                    var mirroringProperty = property.mirroredFromProperty();
                    var propertyValueVar = mapping.getComplexProperty(mirroringProperty.getName()).getVariable();
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
        this.branch(entityType.getProperty("Id").getNamespacedUri(), mapping.getElementaryPropertyVariable("Id"));
        var directPropertyPattern = new DirectPropertiesGraphPattern(entityType, mapping, "no-id-property");
        this.newUnionPattern(directPropertyPattern);
        Object.keys(expandTree).forEach(function (propertyName) {
            var property = entityType.getProperty(propertyName);
            var propertyType = property.getEntityType();
            // Next recursion level
            var gp = new ExpandTreeGraphPattern(propertyType, expandTree[propertyName], mapping.getComplexProperty(propertyName));
            if (!property.hasDirectRdfRepresentation()) {
                var inverseProperty = property.getInverseProperty();
                var unionPattern = _this.newUnionPattern();
                unionPattern.inverseBranch(inverseProperty.getNamespacedUri(), gp);
            }
            else {
                _this.newUnionPattern().branch(property.getNamespacedUri(), gp);
            }
        });
    }
    return ExpandTreeGraphPattern;
}(TreeGraphPattern));
exports.ExpandTreeGraphPattern = ExpandTreeGraphPattern;

//# sourceMappingURL=../../maps/src/adapter/sparql_graphpatterns.js.map
