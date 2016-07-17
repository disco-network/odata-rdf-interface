"use strict";
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
var schema = require("../odata/schema");
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

//# sourceMappingURL=../../../maps/src/adapter/graphpatterninsertions.js.map
