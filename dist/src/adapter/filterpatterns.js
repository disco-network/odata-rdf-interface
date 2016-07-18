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
    FilterGraphPatternFactory.createAnyExpressionPattern = function (filterContext, propertyTree, lambdaExpression, pathToAny) {
        var ret = this.create(filterContext, propertyTree);
        if (pathToAny.length === 0)
            throw new Error("pathToAny is empty");
        var conjunctivePattern;
        var currentPropertyType;
        var currentMapping;
        var nextPropertyIndex;
        if (pathToAny.length === 1 || filterContext.lambdaExpressions[pathToAny[0]] === undefined) {
            conjunctivePattern = ret.newConjunctivePattern();
            currentPropertyType = filterContext.entityType;
            currentMapping = filterContext.mapping;
            nextPropertyIndex = 0;
        }
        else {
            var firstPropertyInPath = pathToAny[0];
            nextPropertyIndex = 1;
            // adopt the root variable of the lambda expression
            conjunctivePattern = ret.newConjunctivePattern(new gpatterns.TreeGraphPattern(filterContext.mapping.getLambdaNamespace(firstPropertyInPath).getVariable()));
            currentPropertyType = filterContext.lambdaExpressions[firstPropertyInPath].entityType;
            currentMapping = filterContext.mapping.getLambdaNamespace(firstPropertyInPath);
        }
        // create a branch path to the property
        var branchingContext = {
            mapping: currentMapping,
            entityType: currentPropertyType,
            pattern: conjunctivePattern,
        };
        branchingContext = this.branchAlongPropertyChain(branchingContext, pathToAny.slice(nextPropertyIndex, -1));
        var lastPropertyName = pathToAny[pathToAny.length - 1];
        this.singleBranch(branchingContext, lastPropertyName, new gpatterns.TreeGraphPattern(branchingContext.mapping.getLambdaNamespace(lastPropertyName).getVariable()));
        return ret;
    };
    FilterGraphPatternFactory.branchAlongPropertyChain = function (baseBranchingContext, propertyChain) {
        var branchingContext = baseBranchingContext;
        for (var i = 0; i < propertyChain.length; ++i) {
            var value = new gpatterns.TreeGraphPattern(branchingContext.mapping.getComplexProperty(propertyChain[i]).getVariable());
            branchingContext = this.singleBranch(branchingContext, propertyChain[i], value);
        }
        return branchingContext;
    };
    FilterGraphPatternFactory.singleBranch = function (context, property, value) {
        var result = value;
        new gpatternInsertions.ComplexBranchInsertionBuilderForFiltering()
            .setMapping(context.mapping)
            .setComplexProperty(context.entityType.getProperty(property))
            .setValue(result)
            .buildCommand()
            .applyTo(context.pattern);
        return {
            mapping: context.mapping.getComplexProperty(property),
            entityType: context.entityType.getProperty(property).getEntityType(),
            pattern: result,
        };
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
