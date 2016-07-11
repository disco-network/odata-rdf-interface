"use strict";
var QueryComposer = (function () {
    function QueryComposer(entitySetName, schema) {
        this.entitySetName = entitySetName;
        this.path = [];
        this.schema = schema;
        this.currentSchema = schema.entitySets[entitySetName];
        this.currentIsCollection = true;
    }
    QueryComposer.prototype.filter = function (filterOption) {
        this.filterOption = filterOption;
    };
    QueryComposer.prototype.expand = function (expandOption) {
        var expandTree = this.expandTree = {};
        (expandOption || []).forEach(function (e) {
            var currentBranch = expandTree;
            e.path.forEach(function (prop) {
                currentBranch = currentBranch[prop] = currentBranch[prop] || {};
            });
        });
    };
    QueryComposer.prototype.selectById = function (id) {
        if (!this.currentIsCollection)
            throw new Error("current query part should be a collection");
        this.path.push({ type: "by-id", id: id, resultQuantity: "one" });
        this.currentIsCollection = false;
        this.currentSchema = this.schema.entityTypes[this.currentSchema.type];
    };
    QueryComposer.prototype.selectProperty = function (property) {
        if (this.currentIsCollection)
            throw new Error("current query part should be no collection");
        if (this.currentSchema.properties[property] == null)
            throw new Error("property does not exist: " + property);
        var propertySchema = this.currentSchema.properties[property];
        this.currentIsCollection = propertySchema.quantity === "many-to-one" || propertySchema.quantity === "many-to-many";
        this.path.push({ type: "property", name: property, resultQuantity: "many" });
        if (this.currentIsCollection)
            this.currentSchema = this.collectionSchema(propertySchema.type);
        else
            this.currentSchema = this.singleSchema(propertySchema.type);
    };
    QueryComposer.prototype.collectionSchema = function (type) {
        return { type: type };
    };
    QueryComposer.prototype.singleSchema = function (type) {
        return this.schema.entityTypes[type];
    };
    return QueryComposer;
}());
exports.QueryComposer = QueryComposer;

//# sourceMappingURL=../../../maps/src/odata/querycomposer.js.map
