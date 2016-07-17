"use strict";
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
var gpatterns = require("../odata/graphpatterns");
var gpatternInsertions = require("./graphpatterninsertions");
/**
 * Creates a SPARQL graph pattern involving all direct and elementary
 * properties belonging to the OData entity type passed as schema.
 * Please separate the options like this: "no-id-property|some-other-option"
 */
var DirectPropertiesGraphPatternFactory = (function () {
    function DirectPropertiesGraphPatternFactory() {
    }
    DirectPropertiesGraphPatternFactory.create = function (entityType, mapping, options) {
        var result = new gpatterns.TreeGraphPattern(mapping.getVariable());
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
        var result = new gpatterns.TreeGraphPattern(mapping.getVariable());
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
var ComplexBranchInsertionBuilder = (function (_super) {
    __extends(ComplexBranchInsertionBuilder, _super);
    function ComplexBranchInsertionBuilder() {
        _super.apply(this, arguments);
    }
    ComplexBranchInsertionBuilder.prototype.buildCommandNoValidityChecks = function () {
        if (this.property.hasDirectRdfRepresentation()) {
            return new gpatternInsertions.NormalBranchInsertionCommand()
                .branch(this.property.getNamespacedUri(), this.value);
        }
        else {
            var inverseProperty = this.property.getInverseProperty();
            return new gpatternInsertions.InverseBranchInsertionCommand()
                .branch(inverseProperty.getNamespacedUri(), this.value);
        }
    };
    return ComplexBranchInsertionBuilder;
}(gpatternInsertions.AbstractComplexBranchInsertionBuilder));
exports.ComplexBranchInsertionBuilder = ComplexBranchInsertionBuilder;
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
        return property.isOptional() ?
            new gpatternInsertions.OptionalBranchInsertionCommand() : new gpatternInsertions.NormalBranchInsertionCommand();
    };
    return ElementaryBranchInsertionBuilder;
}(gpatternInsertions.AbstractElementaryBranchInsertionBuilder));
exports.ElementaryBranchInsertionBuilder = ElementaryBranchInsertionBuilder;

//# sourceMappingURL=../../../maps/src/adapter/expandtree.js.map
