"use strict";
/** @module */
var Schema = require("./schema");
/** This class can be used to generate odata output from different sources.
 * The concrete database logic is handled by the result and context parameters.
 */
var JsonResultBuilder = (function () {
    function JsonResultBuilder() {
    }
    JsonResultBuilder.prototype.run = function (results, context) {
        var entityCollection = new EntityCollection(context, Schema.EntityKind.Complex);
        /* @smell */
        results.forEach(function (result) {
            entityCollection.applyResult(result);
        });
        return entityCollection.serializeToODataJson();
    };
    return JsonResultBuilder;
}());
exports.JsonResultBuilder = JsonResultBuilder;
var EntityCollection = (function () {
    function EntityCollection(context, kind) {
        this.entities = {};
        this.context = context;
        this.kind = kind;
    }
    ///
    EntityCollection.prototype.applyResult = function (result) {
        var id = this.context.getUniqueIdOfResult(result);
        if (this.entities[id] === undefined) {
            this.entities[id] = EntityFactory.fromEntityKind(this.kind, this.context);
        }
        this.entities[id].applyResult(result);
    };
    EntityCollection.prototype.serializeToODataJson = function () {
        var _this = this;
        return Object.keys(this.entities).map(function (id) { return _this.entities[id].serializeToODataJson(); });
    };
    return EntityCollection;
}());
exports.EntityCollection = EntityCollection;
var ComplexEntity = (function () {
    function ComplexEntity(context) {
        this.value = undefined;
        this.context = context;
    }
    ComplexEntity.prototype.applyResult = function (result) {
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
    ComplexEntity.prototype.serializeToODataJson = function () {
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
    ComplexEntity.prototype.initializeWithId = function (id) {
        this.id = id;
        this.value = {};
    };
    ComplexEntity.prototype.applyResultToProperty = function (result, property, hasValueInResult) {
        if (!this.hasPropertyEntity(property)) {
            this.setPropertyEntity(property, EntityFactory.fromPropertyWithContext(property, this.context));
        }
        if (hasValueInResult)
            this.value[property.getName()].applyResult(result);
    };
    ComplexEntity.prototype.hasPropertyEntity = function (property) {
        return this.getPropertyEntity(property) !== undefined;
    };
    ComplexEntity.prototype.getPropertyEntity = function (property) {
        return this.value[property.getName()];
    };
    ComplexEntity.prototype.setPropertyEntity = function (property, value) {
        this.value[property.getName()] = value;
    };
    return ComplexEntity;
}());
exports.ComplexEntity = ComplexEntity;
var ElementaryEntity = (function () {
    function ElementaryEntity() {
        this.value = undefined;
    }
    ElementaryEntity.prototype.applyResult = function (value) {
        if (this.value === undefined) {
            this.value = value;
        }
        else if (this.value !== value) {
            throw new Error("found different values for a property of quantity one");
        }
    };
    ElementaryEntity.prototype.serializeToODataJson = function () {
        return this.value === undefined ? null : this.value;
    };
    return ElementaryEntity;
}());
exports.ElementaryEntity = ElementaryEntity;
var EntityFactory = (function () {
    function EntityFactory() {
    }
    EntityFactory.fromPropertyWithContext = function (property, context) {
        var kind = property.getEntityKind();
        var subContext = context.getSubContext(property.getName());
        if (property.isQuantityOne()) {
            return EntityFactory.fromEntityKind(kind, subContext);
        }
        else {
            return new EntityCollection(subContext, kind);
        }
    };
    EntityFactory.fromEntityKind = function (kind, context) {
        switch (kind) {
            case Schema.EntityKind.Elementary:
                return new ElementaryEntity();
            case Schema.EntityKind.Complex:
                return new ComplexEntity(context);
            default:
                throw new Error("invalid EntityKind " + kind);
        }
    };
    return EntityFactory;
}());
exports.EntityFactory = EntityFactory;

//# sourceMappingURL=../../../maps/src/odata/queries.js.map
