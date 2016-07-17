"use strict";
var gpatternInsertions = require("./graphpatterninsertions");
var schema = require("../odata/schema");
var gpatterns = require("../odata/graphpatterns");
var FilterGraphPatternFactory = (function () {
    function FilterGraphPatternFactory() {
    }
    FilterGraphPatternFactory.create = function (queryContext, propertyTree) {
        var mapping = queryContext.mapping;
        var entityType = queryContext.entityType;
        var result = new gpatterns.TreeGraphPattern(mapping.getVariable());
        Object.keys(propertyTree).forEach(function (propertyName) {
            var property = entityType.getProperty(propertyName);
            switch (property.getEntityKind()) {
                case schema.EntityKind.Elementary:
                    new gpatternInsertions.ElementaryBranchInsertionBuilderForFiltering()
                        .setElementaryProperty(property)
                        .setMapping(mapping)
                        .buildCommand()
                        .applyTo(result);
                    break;
                case schema.EntityKind.Complex:
                    if (!property.isCardinalityOne())
                        throw new Error("Properties of higher cardinality are not allowed.");
                    var subQueryContext = {
                        mapping: mapping.getComplexProperty(propertyName),
                        entityType: property.getEntityType(),
                        lambdaExpressions: [],
                    };
                    var branchedPattern = FilterGraphPatternFactory.create(subQueryContext, propertyTree[propertyName]);
                    new gpatternInsertions.ComplexBranchInsertionBuilderForFiltering()
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

//# sourceMappingURL=../../../maps/src/adapter/filterpatterns.js.map
