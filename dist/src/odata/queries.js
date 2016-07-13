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
        if (this.entities[id] === undefined) {
            this.entities[id] = EvaluatedEntityFactory.fromEntityKind(this.kind, this.context);
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
        var resultId = this.context.getUniqueIdOfResult(result);
        var firstResultOrSameId = this.id === undefined || resultId === this.id;
        if (firstResultOrSameId) {
            if (this.value === undefined) {
                this.initializeWithId(resultId);
            }
            this.context.forEachPropertyOfResult(result, function (resultOfProperty, property, hasValueInResult) {
                _this.applyResultToProperty(resultOfProperty, property, hasValueInResult);
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
            var entity = _this.getPropertyEntity(property);
            var entityExists = _this.hasPropertyEntity(property);
            serialized[propertyName] = entityExists ? entity.serializeToODataJson() : null;
        };
        this.context.forEachPropertySchema(serializeProperty);
        return serialized;
    };
    EvaluatedComplexEntity.prototype.initializeWithId = function (id) {
        this.id = id;
        this.value = {};
    };
    EvaluatedComplexEntity.prototype.applyResultToProperty = function (result, property, hasValueInResult) {
        if (!this.hasPropertyEntity(property)) {
            this.setPropertyEntity(property, EvaluatedEntityFactory.fromPropertyWithContext(property, this.context));
        }
        if (hasValueInResult)
            this.value[property.getName()].applyResult(result);
    };
    EvaluatedComplexEntity.prototype.hasPropertyEntity = function (property) {
        return this.getPropertyEntity(property) !== undefined;
    };
    EvaluatedComplexEntity.prototype.getPropertyEntity = function (property) {
        return this.value[property.getName()];
    };
    EvaluatedComplexEntity.prototype.setPropertyEntity = function (property, value) {
        this.value[property.getName()] = value;
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
