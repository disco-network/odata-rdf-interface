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
            entityCollection.applyResult(result);
        });
        return entityCollection.serializeToODataJson();
    };
    return QueryResultEvaluator;
}());
exports.QueryResultEvaluator = QueryResultEvaluator;
var EvaluatedEntityCollection = (function () {
    function EvaluatedEntityCollection(context, kind) {
        this.entities = {};
        this.context = context;
        this.kind = kind;
    }
    EvaluatedEntityCollection.prototype.applyResult = function (result) {
        var id = this.context.getUniqueIdOfResult(result);
        if (id === undefined)
            return;
        if (this.entities[id] === undefined) {
            if (this.kind === Schema.EntityKind.Elementary)
                this.entities[id] = new EvaluatedElementaryEntity();
            else
                this.entities[id] = new EvaluatedComplexEntity(this.context);
        }
        this.entities[id].applyResult(result);
    };
    EvaluatedEntityCollection.prototype.serializeToODataJson = function () {
        var _this = this;
        return Object.keys(this.entities).map(function (id) { return _this.entities[id].serializeToODataJson(); });
    };
    return EvaluatedEntityCollection;
}());
exports.EvaluatedEntityCollection = EvaluatedEntityCollection;
var EvaluatedComplexEntity = (function () {
    function EvaluatedComplexEntity(context) {
        this.value = undefined;
        this.context = context;
    }
    EvaluatedComplexEntity.prototype.applyResult = function (result) {
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
                _this.applyResultToProperty(property, value);
            });
            this.context.forEachComplexPropertyOfResult(result, function (value, property, hasValue) {
                _this.applyResultToProperty(property, value);
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
    EvaluatedComplexEntity.prototype.applyResultToProperty = function (property, result) {
        if (this.value[property.getName()] === undefined)
            this.value[property.getName()] = EvaluatedEntityFactory.fromPropertyWithContext(property, this.context);
        if (result !== undefined)
            this.value[property.getName()].applyResult(result);
    };
    return EvaluatedComplexEntity;
}());
exports.EvaluatedComplexEntity = EvaluatedComplexEntity;
var EvaluatedElementaryEntity = (function () {
    function EvaluatedElementaryEntity() {
        this.value = undefined;
    }
    EvaluatedElementaryEntity.prototype.applyResult = function (value) {
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
var EvaluatedEntityFactory = (function () {
    function EvaluatedEntityFactory() {
    }
    EvaluatedEntityFactory.fromPropertyWithContext = function (property, context) {
        var kind = property.getEntityKind();
        var subContext = context.getSubContext(property.getName());
        if (property.isQuantityOne()) {
            return EvaluatedEntityFactory.fromEntityKind(kind, subContext);
        }
        else {
            return new EvaluatedEntityCollection(subContext, kind);
        }
    };
    EvaluatedEntityFactory.fromEntityKind = function (kind, context) {
        switch (kind) {
            case Schema.EntityKind.Elementary:
                return new EvaluatedElementaryEntity();
            case Schema.EntityKind.Complex:
                return new EvaluatedComplexEntity(context);
            default:
                throw new Error("invalid EntityKind " + kind);
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
