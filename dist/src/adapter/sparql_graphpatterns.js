"use strict";
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
var Schema = require("../odata/schema");
var GraphPatternWithBranches = (function () {
    function GraphPatternWithBranches(createTriple) {
        this.branches = {};
        this.createTriple = createTriple;
    }
    GraphPatternWithBranches.prototype.branch = function (property, arg) {
        switch (typeof arg) {
            case "undefined":
                return this.branches[property] || [];
            case "object":
                if (this.branches[property] !== undefined)
                    this.branches[property].push(arg);
                else
                    this.branches[property] = [arg];
                return arg;
            default:
                throw new Error("branch argument was specified but is no object");
        }
    };
    GraphPatternWithBranches.prototype.getDirectTriples = function () {
        var _this = this;
        var triples = [];
        this.enumerateBranches(function (property, branch) {
            triples.push(_this.createTriple(property, branch));
        });
        return triples;
    };
    GraphPatternWithBranches.prototype.getBranchPatterns = function () {
        var patterns = [];
        this.enumerateBranches(function (property, branch) { return patterns.push(branch); });
        return patterns;
    };
    GraphPatternWithBranches.prototype.enumerateBranches = function (fn) {
        var _loop_1 = function(property) {
            var branches = this_1.branches[property];
            branches.forEach(function (branch) { return fn(property, branch); });
        };
        var this_1 = this;
        for (var property in this.branches) {
            _loop_1(property);
        }
    };
    GraphPatternWithBranches.prototype.merge = function (other) {
        var _this = this;
        other.enumerateBranches(function (property, branch) {
            _this.branch(property, branch);
        });
    };
    return GraphPatternWithBranches;
}());
exports.GraphPatternWithBranches = GraphPatternWithBranches;
/**
 * Provides a SPARQL graph pattern whose triples are generated from a
 * property tree
 */
var TreeGraphPattern = (function () {
    function TreeGraphPattern(rootName) {
        var _this = this;
        this.valueLeaves = {};
        this.unionPatterns = [];
        var createTriple = function (property, branch) {
            return [_this.name(), property, branch.name()];
        };
        var createInverseTriple = function (property, branch) {
            return [branch.name(), property, _this.name()];
        };
        this.rootName = rootName;
        this.branchPattern = new GraphPatternWithBranches(createTriple);
        this.inverseBranchPattern = new GraphPatternWithBranches(createInverseTriple);
        this.optionalBranchPattern = new GraphPatternWithBranches(createTriple);
        this.optionalInverseBranchPattern = new GraphPatternWithBranches(createInverseTriple);
    }
    TreeGraphPattern.prototype.getDirectTriples = function () {
        var _this = this;
        var triples = [];
        var _loop_2 = function(property) {
            var leaves = this_2.valueLeaves[property];
            leaves.forEach(function (leaf) {
                triples.push([_this.name(), property, "\"" + leaf.value + "\""]);
            });
        };
        var this_2 = this;
        for (var property in this.valueLeaves) {
            _loop_2(property);
        }
        triples.push.apply(triples, this.branchPattern.getDirectTriples());
        triples.push.apply(triples, this.inverseBranchPattern.getDirectTriples());
        return triples;
    };
    TreeGraphPattern.prototype.getBranchPatterns = function () {
        var branches = [];
        branches.push.apply(branches, this.branchPattern.getBranchPatterns());
        branches.push.apply(branches, this.inverseBranchPattern.getBranchPatterns());
        return branches;
    };
    TreeGraphPattern.prototype.getOptionalPatterns = function () {
        var _this = this;
        var patterns = [];
        var addBranch = function (property, branch) {
            var gp = new TreeGraphPattern(_this.name());
            gp.branch(property, branch);
            patterns.push(gp);
        };
        var addInverseBranch = function (property, branch) {
            var gp = new TreeGraphPattern(_this.name());
            gp.inverseBranch(property, branch);
            patterns.push(gp);
        };
        this.optionalBranchPattern.enumerateBranches(addBranch);
        this.optionalInverseBranchPattern.enumerateBranches(addInverseBranch);
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
            case "undefined":
            case "object":
                if (arg instanceof ValueLeaf) {
                    if (this.valueLeaves[property] !== undefined)
                        this.valueLeaves[property].push(arg);
                    else
                        this.valueLeaves[property] = [arg];
                    return;
                }
                else
                    return this.branchPattern.branch(property, arg);
            case "string":
                var pat = new TreeGraphPattern(arg);
                return this.branch(property, pat);
            default:
                throw new Error("branch argument is neither string nor TreeGraphPattern respective ValueLeaf");
        }
    };
    TreeGraphPattern.prototype.inverseBranch = function (property, arg) {
        switch (typeof arg) {
            case "undefined":
            case "object":
                return this.inverseBranchPattern.branch(property, arg);
            case "string":
                var pat = new TreeGraphPattern(arg);
                return this.inverseBranchPattern.branch(property, pat);
            default:
                throw new Error("branch argument is neither string nor object");
        }
    };
    TreeGraphPattern.prototype.optionalBranch = function (property, arg) {
        switch (typeof arg) {
            case "undefined":
            case "object":
                return this.optionalBranchPattern.branch(property, arg);
            case "string":
                var pat = new TreeGraphPattern(arg);
                return this.optionalBranchPattern.branch(property, pat);
            default:
                throw new Error("branch argument is neither string nor object");
        }
    };
    TreeGraphPattern.prototype.optionalInverseBranch = function (property, arg) {
        switch (typeof arg) {
            case "undefined":
            case "object":
                return this.optionalInverseBranchPattern.branch(property, arg);
            case "string":
                var pat = new TreeGraphPattern(arg);
                return this.optionalInverseBranchPattern.branch(property, pat);
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
        return this.branchPattern.branch(property).length > 0;
    };
    TreeGraphPattern.prototype.merge = function (other) {
        if (this.rootName !== other.rootName)
            throw new Error("can\'t merge trees with different roots");
        this.branchPattern.merge(other.branchPattern);
        this.inverseBranchPattern.merge(other.inverseBranchPattern);
        this.optionalBranchPattern.merge(other.optionalBranchPattern);
        /* @todo unions */
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
                new ODataBasedElementaryBranchInsertionBuilder()
                    .setMapping(mapping)
                    .setElementaryProperty(property)
                    .buildCommand()
                    .applyTo(this);
            }
        }
    }
    return DirectPropertiesGraphPattern;
}(TreeGraphPattern));
exports.DirectPropertiesGraphPattern = DirectPropertiesGraphPattern;
/**
 * Provides a SPARQL graph pattern according to an entity type schema, an expand tree
 * (only considering complex properties) and a StructuredSparqlVariableMapping
 * so that it contains all data necessary for an OData $expand query.
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
var ODataBasedElementaryBranchInsertionBuilder = (function () {
    function ODataBasedElementaryBranchInsertionBuilder() {
    }
    ODataBasedElementaryBranchInsertionBuilder.prototype.setElementaryProperty = function (property) {
        if (property.getEntityKind() === Schema.EntityKind.Elementary)
            this.property = property;
        else
            throw new Error("property should be elementary");
        return this;
    };
    ODataBasedElementaryBranchInsertionBuilder.prototype.setMapping = function (mapping) {
        this.mapping = mapping;
        return this;
    };
    ODataBasedElementaryBranchInsertionBuilder.prototype.buildCommand = function () {
        if (this.property !== undefined && this.mapping !== undefined) {
            return this.buildCommandNoValidityChecks();
        }
        else
            throw new Error("Don't forget to set property and value before building the branch insertion command!");
    };
    ODataBasedElementaryBranchInsertionBuilder.prototype.buildCommandNoValidityChecks = function () {
        if (this.property.mirroredFromProperty()) {
            return this.buildMirroringPropertyNoValidityChecks();
        }
        else {
            return this.buildNotMirroringPropertyNoValidityChecks();
        }
    };
    ODataBasedElementaryBranchInsertionBuilder.prototype.buildMirroringPropertyNoValidityChecks = function () {
        var mirroringProperty = this.property.mirroredFromProperty();
        var mirroringPropertyVariable = this.mapping.getComplexProperty(mirroringProperty.getName()).getVariable();
        var insertionCommand = this.createMandatoryOrOptionalCommand(mirroringProperty);
        insertionCommand
            .branch(mirroringProperty.getNamespacedUri(), mirroringPropertyVariable)
            .branch("disco:id", this.mapping.getElementaryPropertyVariable(this.property.getName()));
        return insertionCommand;
    };
    ODataBasedElementaryBranchInsertionBuilder.prototype.buildNotMirroringPropertyNoValidityChecks = function () {
        var insertionCommand = this.createMandatoryOrOptionalCommand(this.property);
        insertionCommand
            .branch(this.property.getNamespacedUri(), this.mapping.getElementaryPropertyVariable(this.property.getName()));
        return insertionCommand;
    };
    ODataBasedElementaryBranchInsertionBuilder.prototype.createMandatoryOrOptionalCommand = function (property) {
        return property.isOptional() ? new OptionalBranchInsertionCommand() : new NormalBranchInsertionCommand();
    };
    return ODataBasedElementaryBranchInsertionBuilder;
}());
exports.ODataBasedElementaryBranchInsertionBuilder = ODataBasedElementaryBranchInsertionBuilder;
var NormalBranchInsertionCommand = (function () {
    function NormalBranchInsertionCommand() {
        this.branchingChain = [];
    }
    NormalBranchInsertionCommand.prototype.branch = function (property, value) {
        this.branchingChain.push({ property: property, value: value });
        return this;
    };
    NormalBranchInsertionCommand.prototype.applyTo = function (graphPattern) {
        var currentBranch = graphPattern;
        for (var i = 0; i < this.branchingChain.length; ++i) {
            var step = this.branchingChain[i];
            currentBranch = currentBranch.branch(step.property, step.value);
        }
    };
    return NormalBranchInsertionCommand;
}());
exports.NormalBranchInsertionCommand = NormalBranchInsertionCommand;
var OptionalBranchInsertionCommand = (function () {
    function OptionalBranchInsertionCommand() {
        this.branchingChain = [];
    }
    OptionalBranchInsertionCommand.prototype.branch = function (property, value) {
        this.branchingChain.push({ property: property, value: value });
        return this;
    };
    OptionalBranchInsertionCommand.prototype.applyTo = function (graphPattern) {
        var currentBranch = graphPattern;
        for (var i = 0; i < this.branchingChain.length; ++i) {
            var step = this.branchingChain[i];
            if (i === 0) {
                currentBranch = currentBranch.optionalBranch(step.property, step.value);
            }
            else {
                currentBranch = currentBranch.branch(step.property, step.value);
            }
        }
    };
    return OptionalBranchInsertionCommand;
}());
exports.OptionalBranchInsertionCommand = OptionalBranchInsertionCommand;
var FilterGraphPattern = (function (_super) {
    __extends(FilterGraphPattern, _super);
    function FilterGraphPattern(entityType, propertyTree, mapping) {
        var _this = this;
        _super.call(this, mapping.getVariable());
        Object.keys(propertyTree).forEach(function (propertyName) {
            var property = entityType.getProperty(propertyName);
            switch (property.getEntityKind()) {
                case Schema.EntityKind.Elementary:
                    if (property.mirroredFromProperty()) {
                        var mirroringProperty = property.mirroredFromProperty();
                        var mirroringPropertyVar = mapping.getComplexProperty(mirroringProperty.getName()).getVariable();
                        _this
                            .optionalBranch(mirroringProperty.getNamespacedUri(), mirroringPropertyVar)
                            .branch("disco:id", mapping.getElementaryPropertyVariable(propertyName));
                    }
                    else {
                        _this.optionalBranch(property.getNamespacedUri(), mapping.getElementaryPropertyVariable(propertyName));
                    }
                    break;
                case Schema.EntityKind.Complex:
                    if (!property.isQuantityOne())
                        throw new Error("properties of higher cardinality are not allowed");
                    var branchedPattern = new FilterGraphPattern(property.getEntityType(), propertyTree[propertyName], mapping.getComplexProperty(propertyName));
                    if (property.hasDirectRdfRepresentation()) {
                        _this.optionalBranch(property.getNamespacedUri(), branchedPattern);
                    }
                    else {
                        var inverseProperty = property.getInverseProperty();
                        _this.optionalInverseBranch(inverseProperty.getNamespacedUri(), branchedPattern);
                    }
                    break;
                default:
                    throw new Error("invalid entity kind " + property.getEntityKind());
            }
        });
    }
    return FilterGraphPattern;
}(TreeGraphPattern));
exports.FilterGraphPattern = FilterGraphPattern;

//# sourceMappingURL=../../../maps/src/adapter/sparql_graphpatterns.js.map
