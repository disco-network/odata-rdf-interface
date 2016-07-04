/** @module */
var _ = require('../util');

var raw = {
  entityTypes: {
    Post: {
      properties: {
        Id: { autoIncrement_nextValue: 3, type: "Edm.Int64", rdfName: "id", nullable: "auto-increment" },
        ContentId: { type: "Edm.Int64", mirroredFromNavigationProperty: "Content", nullable: false },
        ParentId: { type: "Edm.Int64", mirroredFromNavigationProperty: "Parent" },
        Parent: { type: "Post", optional: true, quantity: "one-to-many", mirroredIndexProperty: "ParentId", foreignSet: "Posts", foreignProperty: "Children", rdfName: "parent", nullable: true },
        Children: { type: "Post", quantity: "many-to-one", foreignSet: "Posts", foreignProperty: "Parent" },
        Content: { type: "Post", quantity: "one-to-many", mirroredIndexProperty: "ContentId", rdfName: "content" }
      },
      rdfName: "Post"
    },
  },
  entitySets: {
    Posts: {
      type: "Post"
    }
  },
  defaultNamespace: {
    prefix: "disco",
    uri: "http://disco-network.org/resource/"
  }
};

var Schema = _.defClass(null,
function Schema() {
  this.raw = raw;
},
{
  getEntitySet: function(name) {
    return new EntitySet(this, name);
  },
  getEntityType: function(name) {
    return new EntityType(this, name);
  }
});

var EntitySet = _.defClass(null,
function EntitySet(completeSchema, name) {
  this.completeSchema = completeSchema;
  this.name = name;
},
{
  getEntityType: function() {
    return this.completeSchema.getEntityType(this.getEntityTypeName());
  },
  getEntityTypeName: function() {
    return this.completeSchema.raw.entitySets[this.name].type;
  }
});

var RdfBasedSchemaResource = _.defClass(null,
function RdfBasedSchemaResource(completeSchema, rawSchemaBranch, name) {
  this.name = name;
  this.completeSchema = completeSchema;
  this.rawSchemaBranch = rawSchemaBranch;
  this.rdfName = rawSchemaBranch && rawSchemaBranch.rdfName;
},
{
  getUri: function() {
    return this.completeSchema.raw.defaultNamespace.uri + this.rdfName;
  },
  getNamespacedUri: function() {
    return this.completeSchema.raw.defaultNamespace.prefix + ':' + this.rdfName;
  },
  getName: function() {
    return this.name;
  },
  getRaw: function() {
    return this.rawSchemaBranch;
  },
  hasDirectRdfRepresentation: function() {
    return this.rdfName != null;
  }
});

var EntityType = _.defClass(RdfBasedSchemaResource,
function EntityType(completeSchema, name) {
  RdfBasedSchemaResource.call(this, completeSchema, completeSchema.raw.entityTypes[name], name);
},
{
  getUri: function() {
    if(this.isElementary()) throw new Error('elementary types don\'t have a URI representation [' + this.getName() + ']');
    return RdfBasedSchemaResource.prototype.getUri.call(this);
  },
  getNamespacedUri: function() {
    if(this.isElementary()) throw new Error('elementary types don\'t have a URI representation [' + this.getName() + ']');
    return RdfBasedSchemaResource.prototype.getNamespacedUri.call(this);
  },
  isElementary: function() {
    return this.getName().substr(0,4) == 'Edm.';
  },
  getProperty: function(name) {
    return new Property(this.completeSchema, this, name);
  },
  getPropertyNames: function(fn) {
    if(this.isElementary()) throw new Error('elementary types don\'t have properties [' + this.getName() + ']');
    return Object.keys(this.getRaw().properties);
  }
});

var Property = _.defClass(RdfBasedSchemaResource,
function Property(completeSchema, parentTypeSchema, name) {
  RdfBasedSchemaResource.call(this, completeSchema, parentTypeSchema.getRaw().properties[name], name);
  this.parentType = parentTypeSchema;
},
{
  getEntityType: function() {
    return this.completeSchema.getEntityType(this.getRaw().type);
  },
  isNavigationProperty: function() {
    return this.getEntityType().isElementary() == false;
  },
  isQuantityOne: function() {
    return this.getRaw().quantity.substr(0,4) === 'one-';
  },
  isOptional: function() {
    return this.getRaw().optional == true;
  },
  hasInverseProperty: function() {
    return this.getRaw().foreignProperty != null;
  },
  getInverseProperty: function() {
    var setName = this.getRaw().foreignSet;
    var propName = this.getRaw().foreignProperty;
    return this.completeSchema.getEntitySet(setName).getEntityType().getProperty(propName);
  },
  mirroredFromProperty: function() {
    var name = this.getRaw().mirroredFromNavigationProperty;
    return name && new Property(this.completeSchema, this.parentType, this.getRaw().mirroredFromNavigationProperty);
  }
});

module.exports = { Schema: Schema }
