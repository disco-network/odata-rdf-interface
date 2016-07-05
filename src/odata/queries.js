/** @module */
"use strict";
/** This class can be used to generate odata output from different sources.
 * The concrete database logic is handled by the result and context parameters.
 */
var QueryResultEvaluator = (function () {
    function QueryResultEvaluator() {
    }
    // result type corresponds to what's needed by the context instance
    QueryResultEvaluator.prototype.evaluate = function (result, context) {
        var self = this;
        var ret = {};
        context.forEachElementaryPropertyOfResult(result, function (value, property) {
            ret[property.getName()] = value;
        });
        context.forEachComplexPropertyOfResult(result, function (subResult, property) {
            ret[property.getName()] = self.evaluate(subResult, context.getSubContext(property.getName()));
        });
        return ret;
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
