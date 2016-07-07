"use strict";
/** This class can be used to generate odata output from different sources.
 * The concrete database logic is handled by the result and context parameters.
 */
var QueryResultEvaluator = (function () {
    function QueryResultEvaluator() {
    }
    // result type corresponds to what's needed by the context instance
    QueryResultEvaluator.prototype.evaluate = function (results, context) {
        var _this = this;
        var entities = {};
        results.forEach(function (result) {
            var id = context.getUniqueIdOfResult(result);
            if (entities[id] === undefined) {
                entities[id] = {};
            }
            context.forEachElementaryPropertyOfResult(result, function (value, property) {
                _this.assignElementaryProperty(entities[id], property, value);
            });
            context.forEachComplexPropertyOfResult(result, function (subResult, property, hasValue) {
                if (hasValue)
                    _this.assignComplexProperty(entities[id], property, subResult, context);
            });
        });
        return Object.keys(entities).map(function (key) { return entities[key]; });
    };
    QueryResultEvaluator.prototype.assignElementaryProperty = function (entity, property, value) {
        var oldValue = entity[property.getName()];
        if (property.isQuantityOne()) {
            if (oldValue !== undefined && value !== undefined && oldValue !== value)
                throw new Error("found different values for a property of quantity one: " + property.getName());
            else
                entity[property.getName()] = value;
        }
    };
    QueryResultEvaluator.prototype.assignComplexProperty = function (entity, property, result, context) {
        var _this = this;
        var oldValue = entity[property.getName()];
        if (property.isQuantityOne()) {
            var subEntity_1;
            if (oldValue !== undefined)
                subEntity_1 = oldValue;
            else
                subEntity_1 = entity[property.getName()] = {};
            var subContext_1 = context.getSubContext(property.getName());
            subContext_1.forEachElementaryPropertyOfResult(result, function (subValue, subProperty) {
                _this.assignElementaryProperty(subEntity_1, subProperty, subValue);
            });
            subContext_1.forEachComplexPropertyOfResult(result, function (subResult, subProperty, hasValue) {
                if (hasValue)
                    _this.assignComplexProperty(subEntity_1, subProperty, subResult, subContext_1);
            });
        }
    };
    return QueryResultEvaluator;
}());
exports.QueryResultEvaluator = QueryResultEvaluator;
(function (ErrorTypes) {
    ErrorTypes[ErrorTypes["NONE"] = 0] = "NONE";
    ErrorTypes[ErrorTypes["DB"] = 1] = "DB";
    ErrorTypes[ErrorTypes["ENTITYSET_NOTFOUND"] = 2] = "ENTITYSET_NOTFOUND";
    ErrorTypes[ErrorTypes["PROPERTY_NOTFOUND"] = 3] = "PROPERTY_NOTFOUND";
})(exports.ErrorTypes || (exports.ErrorTypes = {}));
var ErrorTypes = exports.ErrorTypes;

//# sourceMappingURL=../../maps/src/odata/queries.js.map
