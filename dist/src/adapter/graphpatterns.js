"use strict";
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
var schema = require("../odata/schema");
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
        var _loop_2 = function(property) {
            var branches = this_2.branches[property];
            branches.forEach(function (branch) { return fn(property, branch); });
        };
        var this_2 = this;
        for (var property in this.branches) {
            _loop_2(property);
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
var ValueLeaf = (function () {
    function ValueLeaf(value) {
        this.value = value;
    }
    return ValueLeaf;
}());
exports.ValueLeaf = ValueLeaf;
/**
 * Creates a SPARQL graph pattern involving all direct and elementary
 * properties belonging to the OData entity type passed as schema.
 * Please separate the options like this: "no-id-property|some-other-option"
 */
var DirectPropertiesGraphPatternFactory = (function () {
    function DirectPropertiesGraphPatternFactory() {
    }
    DirectPropertiesGraphPatternFactory.create = function (entityType, mapping, options) {
        var result = new TreeGraphPattern(mapping.getVariable());
        var propertyNames = entityType.getPropertyNames();
        var properties = propertyNames.map(function (p) { return entityType.getProperty(p); });
        for (var i = 0; i < properties.length; ++i) {
            var property = properties[i];
            var propertyName = property.getName();
            if (propertyName === "Id" && options.indexOf("no-id-property") >= 0)
                continue;
            if (property.isNavigationProperty() === false) {
                new ElementaryBranchInsertionBuilder()
                    .setMapping(mapping)
                    .setElementaryProperty(property)
                    .buildCommand()
                    .applyTo(result);
            }
        }
        return result;
    };
    return DirectPropertiesGraphPatternFactory;
}());
exports.DirectPropertiesGraphPatternFactory = DirectPropertiesGraphPatternFactory;
/**
 * Creates a SPARQL graph pattern depending an entity type schema, an expand tree
 * (only considering complex properties) and a StructuredSparqlVariableMapping
 * so that it contains all data necessary for an OData $expand query.
 */
var ExpandTreeGraphPatternFactory = (function () {
    function ExpandTreeGraphPatternFactory() {
    }
    ExpandTreeGraphPatternFactory.create = function (entityType, expandTree, mapping) {
        var result = new TreeGraphPattern(mapping.getVariable());
        result.branch(entityType.getProperty("Id").getNamespacedUri(), mapping.getElementaryPropertyVariable("Id"));
        var directPropertyPattern = DirectPropertiesGraphPatternFactory.create(entityType, mapping, "no-id-property");
        result.newUnionPattern(directPropertyPattern);
        Object.keys(expandTree).forEach(function (propertyName) {
            var property = entityType.getProperty(propertyName);
            var baseGraphPattern = result.newUnionPattern();
            var branch = ExpandTreeGraphPatternFactory.create(property.getEntityType(), expandTree[propertyName], mapping.getComplexProperty(propertyName));
            new ComplexBranchInsertionBuilder()
                .setComplexProperty(property)
                .setValue(branch)
                .setMapping(mapping)
                .buildCommand()
                .applyTo(baseGraphPattern);
        });
        return result;
    };
    return ExpandTreeGraphPatternFactory;
}());
exports.ExpandTreeGraphPatternFactory = ExpandTreeGraphPatternFactory;
var FilterGraphPatternFactory = (function () {
    function FilterGraphPatternFactory() {
    }
    FilterGraphPatternFactory.create = function (entityType, propertyTree, mapping) {
        var result = new TreeGraphPattern(mapping.getVariable());
        Object.keys(propertyTree).forEach(function (propertyName) {
            var property = entityType.getProperty(propertyName);
            switch (property.getEntityKind()) {
                case schema.EntityKind.Elementary:
                    new ElementaryBranchInsertionBuilderForFiltering()
                        .setElementaryProperty(property)
                        .setMapping(mapping)
                        .buildCommand()
                        .applyTo(result);
                    break;
                case schema.EntityKind.Complex:
                    if (!property.isCardinalityOne())
                        throw new Error("Properties of higher cardinality are not allowed.");
                    var branchedPattern = FilterGraphPatternFactory.create(property.getEntityType(), propertyTree[propertyName], mapping.getComplexProperty(propertyName));
                    new ComplexBranchInsertionBuilderForFiltering()
                        .setComplexProperty(property)
                        .setMapping(mapping)
                        .setValue(branchedPattern)
                        .buildCommand()
                        .applyTo(result);
                    break;
                default:
                    throw new Error("invalid entity kind " + property.getEntityKind());
            }
        });
        return result;
    };
    return FilterGraphPatternFactory;
}());
exports.FilterGraphPatternFactory = FilterGraphPatternFactory;
var AbstractBranchInsertionBuilder = (function () {
    function AbstractBranchInsertionBuilder() {
    }
    AbstractBranchInsertionBuilder.prototype.buildCommand = function () {
        if (this.validateParameters()) {
            return this.buildCommandNoValidityChecks();
        }
        else
            throw new Error("Don't forget to set property and mapping before building the branch insertion command!");
    };
    AbstractBranchInsertionBuilder.prototype.setMapping = function (mapping) {
        this.mapping = mapping;
        return this;
    };
    AbstractBranchInsertionBuilder.prototype.validateParameters = function () {
        return this.mapping !== undefined;
    };
    AbstractBranchInsertionBuilder.prototype.buildCommandNoValidityChecks = function () {
        throw new Error("abstract method; not implemented");
    };
    return AbstractBranchInsertionBuilder;
}());
exports.AbstractBranchInsertionBuilder = AbstractBranchInsertionBuilder;
var AbstractComplexBranchInsertionBuilder = (function (_super) {
    __extends(AbstractComplexBranchInsertionBuilder, _super);
    function AbstractComplexBranchInsertionBuilder() {
        _super.apply(this, arguments);
    }
    AbstractComplexBranchInsertionBuilder.prototype.setComplexProperty = function (property) {
        if (property.getEntityKind() === schema.EntityKind.Complex) {
            this.property = property;
            return this;
        }
        else
            throw new Error("property should be complex");
    };
    AbstractComplexBranchInsertionBuilder.prototype.setValue = function (value) {
        this.value = value;
        return this;
    };
    AbstractComplexBranchInsertionBuilder.prototype.validateParameters = function () {
        return _super.prototype.validateParameters.call(this) && this.property !== undefined && this.value !== undefined;
    };
    return AbstractComplexBranchInsertionBuilder;
}(AbstractBranchInsertionBuilder));
exports.AbstractComplexBranchInsertionBuilder = AbstractComplexBranchInsertionBuilder;
var AbstractElementaryBranchInsertionBuilder = (function (_super) {
    __extends(AbstractElementaryBranchInsertionBuilder, _super);
    function AbstractElementaryBranchInsertionBuilder() {
        _super.apply(this, arguments);
    }
    AbstractElementaryBranchInsertionBuilder.prototype.setElementaryProperty = function (property) {
        if (property.getEntityKind() === schema.EntityKind.Elementary)
            this.property = property;
        else
            throw new Error("property should be elementary");
        return this;
    };
    AbstractElementaryBranchInsertionBuilder.prototype.validateParameters = function () {
        return _super.prototype.validateParameters.call(this) && this.property !== undefined;
    };
    return AbstractElementaryBranchInsertionBuilder;
}(AbstractBranchInsertionBuilder));
exports.AbstractElementaryBranchInsertionBuilder = AbstractElementaryBranchInsertionBuilder;
var ComplexBranchInsertionBuilder = (function (_super) {
    __extends(ComplexBranchInsertionBuilder, _super);
    function ComplexBranchInsertionBuilder() {
        _super.apply(this, arguments);
    }
    ComplexBranchInsertionBuilder.prototype.buildCommandNoValidityChecks = function () {
        if (this.property.hasDirectRdfRepresentation()) {
            return new NormalBranchInsertionCommand()
                .branch(this.property.getNamespacedUri(), this.value);
        }
        else {
            var inverseProperty = this.property.getInverseProperty();
            return new InverseBranchInsertionCommand()
                .branch(inverseProperty.getNamespacedUri(), this.value);
        }
    };
    return ComplexBranchInsertionBuilder;
}(AbstractComplexBranchInsertionBuilder));
exports.ComplexBranchInsertionBuilder = ComplexBranchInsertionBuilder;
var ComplexBranchInsertionBuilderForFiltering = (function (_super) {
    __extends(ComplexBranchInsertionBuilderForFiltering, _super);
    function ComplexBranchInsertionBuilderForFiltering() {
        _super.apply(this, arguments);
    }
    ComplexBranchInsertionBuilderForFiltering.prototype.buildCommandNoValidityChecks = function () {
        if (this.property.hasDirectRdfRepresentation()) {
            return new OptionalBranchInsertionCommand()
                .branch(this.property.getNamespacedUri(), this.value);
        }
        else {
            var inverseProperty = this.property.getInverseProperty();
            return new OptionalInverseBranchInsertionCommand()
                .branch(inverseProperty.getNamespacedUri(), this.value);
        }
    };
    return ComplexBranchInsertionBuilderForFiltering;
}(AbstractComplexBranchInsertionBuilder));
exports.ComplexBranchInsertionBuilderForFiltering = ComplexBranchInsertionBuilderForFiltering;
var ElementaryBranchInsertionBuilder = (function (_super) {
    __extends(ElementaryBranchInsertionBuilder, _super);
    function ElementaryBranchInsertionBuilder() {
        _super.apply(this, arguments);
    }
    ElementaryBranchInsertionBuilder.prototype.buildCommandNoValidityChecks = function () {
        if (this.property.mirroredFromProperty()) {
            return this.buildMirroringPropertyNoValidityChecks();
        }
        else {
            return this.buildNotMirroringPropertyNoValidityChecks();
        }
    };
    ElementaryBranchInsertionBuilder.prototype.buildMirroringPropertyNoValidityChecks = function () {
        var mirroringProperty = this.property.mirroredFromProperty();
        var mirroringPropertyVariable = this.mapping.getComplexProperty(mirroringProperty.getName()).getVariable();
        var insertionCommand = this.createMandatoryOrOptionalCommand(mirroringProperty);
        insertionCommand
            .branch(mirroringProperty.getNamespacedUri(), mirroringPropertyVariable)
            .branch("disco:id", this.mapping.getElementaryPropertyVariable(this.property.getName()));
        return insertionCommand;
    };
    ElementaryBranchInsertionBuilder.prototype.buildNotMirroringPropertyNoValidityChecks = function () {
        var insertionCommand = this.createMandatoryOrOptionalCommand(this.property);
        insertionCommand
            .branch(this.property.getNamespacedUri(), this.mapping.getElementaryPropertyVariable(this.property.getName()));
        return insertionCommand;
    };
    ElementaryBranchInsertionBuilder.prototype.createMandatoryOrOptionalCommand = function (property) {
        return property.isOptional() ? new OptionalBranchInsertionCommand() : new NormalBranchInsertionCommand();
    };
    return ElementaryBranchInsertionBuilder;
}(AbstractElementaryBranchInsertionBuilder));
exports.ElementaryBranchInsertionBuilder = ElementaryBranchInsertionBuilder;
var ElementaryBranchInsertionBuilderForFiltering = (function (_super) {
    __extends(ElementaryBranchInsertionBuilderForFiltering, _super);
    function ElementaryBranchInsertionBuilderForFiltering() {
        _super.apply(this, arguments);
    }
    ElementaryBranchInsertionBuilderForFiltering.prototype.buildCommandNoValidityChecks = function () {
        if (this.property.mirroredFromProperty()) {
            return this.buildMirroringPropertyNoValidityChecks();
        }
        else {
            return this.buildNotMirroringPropertyNoValidityChecks();
        }
    };
    ElementaryBranchInsertionBuilderForFiltering.prototype.buildMirroringPropertyNoValidityChecks = function () {
        var mirroringProperty = this.property.mirroredFromProperty();
        var mirroringPropertyVariable = this.mapping.getComplexProperty(mirroringProperty.getName()).getVariable();
        var insertionCommand = this.createCommand(mirroringProperty);
        insertionCommand
            .branch(mirroringProperty.getNamespacedUri(), mirroringPropertyVariable)
            .branch("disco:id", this.mapping.getElementaryPropertyVariable(this.property.getName()));
        return insertionCommand;
    };
    ElementaryBranchInsertionBuilderForFiltering.prototype.buildNotMirroringPropertyNoValidityChecks = function () {
        var insertionCommand = this.createCommand(this.property);
        insertionCommand
            .branch(this.property.getNamespacedUri(), this.mapping.getElementaryPropertyVariable(this.property.getName()));
        return insertionCommand;
    };
    ElementaryBranchInsertionBuilderForFiltering.prototype.createCommand = function (property) {
        return new OptionalBranchInsertionCommand();
    };
    return ElementaryBranchInsertionBuilderForFiltering;
}(AbstractElementaryBranchInsertionBuilder));
exports.ElementaryBranchInsertionBuilderForFiltering = ElementaryBranchInsertionBuilderForFiltering;
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
var InverseBranchInsertionCommand = (function () {
    function InverseBranchInsertionCommand() {
        this.branchingChain = [];
    }
    InverseBranchInsertionCommand.prototype.branch = function (property, value) {
        this.branchingChain.push({ property: property, value: value });
        return this;
    };
    InverseBranchInsertionCommand.prototype.applyTo = function (graphPattern) {
        var currentBranch = graphPattern;
        for (var i = 0; i < this.branchingChain.length; ++i) {
            var step = this.branchingChain[i];
            currentBranch = currentBranch.inverseBranch(step.property, step.value);
        }
    };
    return InverseBranchInsertionCommand;
}());
exports.InverseBranchInsertionCommand = InverseBranchInsertionCommand;
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
var OptionalInverseBranchInsertionCommand = (function () {
    function OptionalInverseBranchInsertionCommand() {
        this.branchingChain = [];
    }
    OptionalInverseBranchInsertionCommand.prototype.branch = function (property, value) {
        this.branchingChain.push({ property: property, value: value });
        return this;
    };
    OptionalInverseBranchInsertionCommand.prototype.applyTo = function (graphPattern) {
        var currentBranch = graphPattern;
        for (var i = 0; i < this.branchingChain.length; ++i) {
            var step = this.branchingChain[i];
            if (i === 0) {
                currentBranch = currentBranch.optionalInverseBranch(step.property, step.value);
            }
            else {
                throw new Error("cannot chain optional inverse branches");
            }
        }
    };
    return OptionalInverseBranchInsertionCommand;
}());
exports.OptionalInverseBranchInsertionCommand = OptionalInverseBranchInsertionCommand;

//# sourceMappingURL=../../../maps/src/adapter/graphpatterns.js.map
