/** @module */
"use strict";
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
var raw = {
    entityTypes: {
        Post: {
            properties: {
                Id: { autoIncrement_nextValue: 3, type: "Edm.Int64", rdfName: "id", nullable: "auto-increment" },
                ContentId: { type: "Edm.Int64", mirroredFromNavigationProperty: "Content" },
                ParentId: { type: "Edm.Int64", mirroredFromNavigationProperty: "Parent" },
                Parent: { type: "Post", optional: true, quantity: "one-to-many",
                    mirroredIndexProperty: "ParentId", foreignSet: "Posts", foreignProperty: "Children",
                    rdfName: "parent", nullable: true },
                Children: { type: "Post", quantity: "many-to-one", foreignSet: "Posts", foreignProperty: "Parent" },
                Content: { type: "Content", quantity: "one-to-many", mirroredIndexProperty: "ContentId", rdfName: "content" },
            },
            rdfName: "Post",
        },
        Content: {
            properties: {
                Id: { type: "Edm.Int64", rdfName: "id" },
                Title: { type: "Edm.String", rdfName: "title" },
                Culture: { type: "Culture", quantity: "one-to-many", rdfName: "culture" },
            },
            rdfName: "Content",
        },
        Culture: {
            properties: {
                Id: { type: "Edm.Int64", rdfName: "id" },
            },
            rdfName: "Culture",
        },
    },
    entitySets: {
        Posts: {
            type: "Post",
        },
        Content: {
            type: "Content",
        },
    },
    defaultNamespace: {
        prefix: "disco",
        uri: "http://disco-network.org/resource/",
    },
};
var Schema = (function () {
    function Schema() {
        this.raw = raw;
    }
    Schema.prototype.getEntitySet = function (name) {
        return new EntitySet(this, name);
    };
    Schema.prototype.getEntityType = function (name) {
        return new EntityType(this, name);
    };
    return Schema;
}());
exports.Schema = Schema;
var EntitySet = (function () {
    function EntitySet(completeSchema, name) {
        this.completeSchema = completeSchema;
        this.name = name;
        this.completeSchema = completeSchema;
        this.name = name;
    }
    EntitySet.prototype.getEntityType = function () {
        return this.completeSchema.getEntityType(this.getEntityTypeName());
    };
    EntitySet.prototype.getEntityTypeName = function () {
        return this.completeSchema.raw.entitySets[this.name].type;
    };
    return EntitySet;
}());
exports.EntitySet = EntitySet;
var RdfBasedSchemaResource = (function () {
    function RdfBasedSchemaResource(completeSchema, rawSchemaBranch, name) {
        this.completeSchema = completeSchema;
        this.rawSchemaBranch = rawSchemaBranch;
        this.name = name;
        this.rdfName = rawSchemaBranch && rawSchemaBranch.rdfName;
    }
    RdfBasedSchemaResource.prototype.getUri = function () {
        return this.completeSchema.raw.defaultNamespace.uri + this.rdfName;
    };
    RdfBasedSchemaResource.prototype.getNamespacedUri = function () {
        return this.completeSchema.raw.defaultNamespace.prefix + ":" + this.rdfName;
    };
    RdfBasedSchemaResource.prototype.getName = function () {
        return this.name;
    };
    RdfBasedSchemaResource.prototype.getRaw = function () {
        return this.rawSchemaBranch;
    };
    RdfBasedSchemaResource.prototype.hasDirectRdfRepresentation = function () {
        return this.rdfName != null;
    };
    return RdfBasedSchemaResource;
}());
exports.RdfBasedSchemaResource = RdfBasedSchemaResource;
var EntityType = (function (_super) {
    __extends(EntityType, _super);
    function EntityType(completeSchema, name) {
        _super.call(this, completeSchema, completeSchema.raw.entityTypes[name], name);
    }
    EntityType.prototype.getUri = function () {
        if (this.isElementary())
            throw new Error("elementary types don\'t have a URI representation [" + this.getName() + "]");
        return _super.prototype.getUri.call(this);
    };
    EntityType.prototype.getNamespacedUri = function () {
        if (this.isElementary())
            throw new Error("elementary types don\'t have a URI representation [" + this.getName() + "]");
        return _super.prototype.getUri.call(this);
    };
    EntityType.prototype.isElementary = function () {
        return this.getName().substr(0, 4) === "Edm.";
    };
    EntityType.prototype.getProperty = function (name) {
        return new Property(this.completeSchema, this, name);
    };
    EntityType.prototype.getPropertyNames = function () {
        if (this.isElementary())
            throw new Error("elementary types don\'t have properties [" + this.getName() + "]");
        return Object.keys(this.getRaw().properties);
    };
    return EntityType;
}(RdfBasedSchemaResource));
exports.EntityType = EntityType;
var Property = (function (_super) {
    __extends(Property, _super);
    function Property(completeSchema, parentType, name) {
        _super.call(this, completeSchema, parentType.getRaw().properties[name], name);
        this.parentType = parentType;
    }
    Property.prototype.getEntityType = function () {
        return this.completeSchema.getEntityType(this.getRaw().type);
    };
    Property.prototype.isNavigationProperty = function () {
        return this.getEntityType().isElementary() === false;
    };
    Property.prototype.isQuantityOne = function () {
        return !this.isNavigationProperty() || this.getRaw().quantity.substr(0, 4) === "one-";
    };
    Property.prototype.isOptional = function () {
        return this.getRaw().optional === true;
    };
    Property.prototype.hasInverseProperty = function () {
        return this.getRaw().foreignProperty != null;
    };
    Property.prototype.getInverseProperty = function () {
        var setName = this.getRaw().foreignSet;
        var propName = this.getRaw().foreignProperty;
        return this.completeSchema.getEntitySet(setName).getEntityType().getProperty(propName);
    };
    Property.prototype.mirroredFromProperty = function () {
        var name = this.getRaw().mirroredFromNavigationProperty;
        return name && new Property(this.completeSchema, this.parentType, this.getRaw().mirroredFromNavigationProperty);
    };
    return Property;
}(RdfBasedSchemaResource));
exports.Property = Property;

//# sourceMappingURL=../../maps/src/odata/schema.js.map
