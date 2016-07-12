"use strict";
/** @module */
var Schema = require("./schema");
/** This class can be used to generate odata output from different sources.
 * The concrete database logic is handled by the result and context parameters.
 */
var QueryResultEvaluator = (function () {
    function QueryResultEvaluator() {
    }
    QueryResultEvaluator.prototype.evaluate = function (results, context) {
        var entityCollection = new EvaluatedEntityCollection(context, Schema.EntityKind.Complex);
        results.forEach(function (result) {
            entityCollection.assignResult(result);
        });
        return entityCollection.serializeToODataJson();
    };
    return QueryResultEvaluator;
}());
exports.QueryResultEvaluator = QueryResultEvaluator;
var EvaluatedElementaryEntity = (function () {
    function EvaluatedElementaryEntity() {
        this.value = undefined;
    }
    EvaluatedElementaryEntity.prototype.assignResult = function (value) {
        if (this.value === undefined) {
            this.value = value;
        }
        else if (this.value !== value) {
            throw new Error("found different values for a property of quantity one");
        }
    };
    EvaluatedElementaryEntity.prototype.serializeToODataJson = function () {
        return this.value === undefined ? null : this.value;
    };
    return EvaluatedElementaryEntity;
}());
exports.EvaluatedElementaryEntity = EvaluatedElementaryEntity;
var EvaluatedComplexEntity = (function () {
    function EvaluatedComplexEntity(context) {
        this.value = undefined;
        this.context = context;
    }
    EvaluatedComplexEntity.prototype.assignResult = function (result) {
        var _this = this;
        var id = this.context.getUniqueIdOfResult(result);
        if (id === undefined)
            return;
        if (this.id === undefined || id === this.id) {
            if (this.value === undefined) {
                this.id = id;
                this.value = {};
            }
            this.context.forEachElementaryPropertyOfResult(result, function (value, property, hasValue) {
                _this.assignResultToProperty(property, value);
            });
            this.context.forEachComplexPropertyOfResult(result, function (value, property, hasValue) {
                _this.assignResultToProperty(property, value);
            });
        }
        else {
            throw new Error("found different values for a property of quantity one");
        }
    };
    EvaluatedComplexEntity.prototype.serializeToODataJson = function () {
        var _this = this;
        if (this.id === undefined)
            return null;
        var serialized = {};
        var serializeProperty = function (property) {
            var propertyName = property.getName();
            var entity = _this.value[propertyName];
            serialized[propertyName] = entity !== undefined ? entity.serializeToODataJson() : null;
        };
        this.context.forEachElementaryPropertySchema(serializeProperty);
        this.context.forEachComplexPropertySchema(serializeProperty);
        return serialized;
    };
    EvaluatedComplexEntity.prototype.assignResultToProperty = function (property, result) {
        if (this.value[property.getName()] === undefined)
            this.value[property.getName()] = EvaluatedEntityFactory.fromPropertyWithContext(property, this.context);
        if (result !== undefined)
            this.value[property.getName()].assignResult(result);
    };
    return EvaluatedComplexEntity;
}());
exports.EvaluatedComplexEntity = EvaluatedComplexEntity;
var EvaluatedEntityCollection = (function () {
    function EvaluatedEntityCollection(context, kind) {
        this.entities = {};
        this.context = context;
        this.kind = kind;
    }
    EvaluatedEntityCollection.prototype.assignResult = function (result) {
        var id = this.context.getUniqueIdOfResult(result);
        if (id === undefined)
            return;
        if (this.entities[id] === undefined) {
            if (this.kind === Schema.EntityKind.Elementary)
                this.entities[id] = new EvaluatedElementaryEntity();
            else
                this.entities[id] = new EvaluatedComplexEntity(this.context);
        }
        this.entities[id].assignResult(result);
    };
    EvaluatedEntityCollection.prototype.serializeToODataJson = function () {
        var _this = this;
        return Object.keys(this.entities).map(function (id) { return _this.entities[id].serializeToODataJson(); });
    };
    return EvaluatedEntityCollection;
}());
exports.EvaluatedEntityCollection = EvaluatedEntityCollection;
var EvaluatedEntityFactory = (function () {
    function EvaluatedEntityFactory() {
    }
    EvaluatedEntityFactory.fromPropertyWithContext = function (property, context) {
        if (property.isQuantityOne()) {
            if (property.getEntityKind() === Schema.EntityKind.Complex) {
                var subContext = context.getSubContext(property.getName());
                return new EvaluatedComplexEntity(subContext);
            }
            else
                return new EvaluatedElementaryEntity();
        }
        else {
            var subContext = context.getSubContext(property.getName());
            var kind = property.getEntityKind();
            return new EvaluatedEntityCollection(subContext, kind);
        }
    };
    return EvaluatedEntityFactory;
}());
exports.EvaluatedEntityFactory = EvaluatedEntityFactory;
(function (ErrorTypes) {
    ErrorTypes[ErrorTypes["NONE"] = 0] = "NONE";
    ErrorTypes[ErrorTypes["DB"] = 1] = "DB";
    ErrorTypes[ErrorTypes["ENTITYSET_NOTFOUND"] = 2] = "ENTITYSET_NOTFOUND";
    ErrorTypes[ErrorTypes["PROPERTY_NOTFOUND"] = 3] = "PROPERTY_NOTFOUND";
})(exports.ErrorTypes || (exports.ErrorTypes = {}));
var ErrorTypes = exports.ErrorTypes;

//# sourceMappingURL=../../../maps/src/odata/queries.js.map
