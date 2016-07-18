"use strict";
var gpatternInsertions = require("./graphpatterninsertions");
var schema = require("../odata/schema");
var gpatterns = require("../odata/graphpatterns");
var FilterGraphPatternFactory = (function () {
    function FilterGraphPatternFactory() {
    }
    FilterGraphPatternFactory.create = function (filterContext, propertyTree) {
        var _this = this;
        var mapping = filterContext.mapping;
        var entityType = filterContext.entityType;
        var result = new gpatterns.TreeGraphPattern(mapping.getVariable());
        Object.keys(propertyTree).forEach(function (propertyName) {
            if (filterContext.lambdaExpressions[propertyName] === undefined) {
                var property = entityType.getProperty(propertyName);
                _this.createAndInsertBranch(result, property, filterContext, propertyTree);
            }
            else {
                var lambdaExpression = filterContext.lambdaExpressions[propertyName];
                var subMapping = mapping.getLambdaNamespace(propertyName);
                var subPropertyTree = propertyTree[propertyName];
                var subEntityType = lambdaExpression.entityType;
                var subContext = {
                    entityType: subEntityType,
                    mapping: subMapping,
                    lambdaExpressions: {},
                };
                result.newConjunctivePattern(_this.create(subContext, subPropertyTree));
            }
        });
        return result;
    };
    FilterGraphPatternFactory.createAndInsertBranch = function (pattern, property, filterContext, propertyTree) {
        var mapping = filterContext.mapping;
        switch (property.getEntityKind()) {
            case schema.EntityKind.Elementary:
                new gpatternInsertions.ElementaryBranchInsertionBuilderForFiltering()
                    .setElementaryProperty(property)
                    .setMapping(mapping)
                    .buildCommand()
                    .applyTo(pattern);
                break;
            case schema.EntityKind.Complex:
                if (!property.isCardinalityOne())
                    throw new Error("Properties of higher cardinality are not allowed.");
                var subQueryContext = {
                    mapping: mapping.getComplexProperty(property.getName()),
                    entityType: property.getEntityType(),
                    lambdaExpressions: {},
                };
                var branchedPattern = this.create(subQueryContext, propertyTree[property.getName()]);
                new gpatternInsertions.ComplexBranchInsertionBuilderForFiltering()
                    .setComplexProperty(property)
                    .setMapping(mapping)
                    .setValue(branchedPattern)
                    .buildCommand()
                    .applyTo(pattern);
                break;
            default:
                throw new Error("invalid entity kind " + property.getEntityKind());
        }
    };
    return FilterGraphPatternFactory;
}());
exports.FilterGraphPatternFactory = FilterGraphPatternFactory;

//# sourceMappingURL=../../../maps/src/adapter/filterpatterns.js.map
