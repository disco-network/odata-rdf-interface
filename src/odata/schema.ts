/** @module */
import _ = require('../util');

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

export class Schema {
  public raw = raw;
  
  public getEntitySet(name: string): EntitySet {
    return new EntitySet(this, name);
  }

  public getEntityType(name: string): EntityType {
    return new EntityType(this, name);
  }
}

export class EntitySet {
	constructor(private completeSchema: Schema, private name: string) {
    this.completeSchema = completeSchema;
    this.name = name;
  }
  
  public getEntityType(): EntityType {
    return this.completeSchema.getEntityType(this.getEntityTypeName());
  }

  public getEntityTypeName(): string {
    return this.completeSchema.raw.entitySets[this.name].type;
  }
}

export class RdfBasedSchemaResource {
  private rdfName: string;

	constructor(protected completeSchema: Schema, private rawSchemaBranch, private name: string) {
    this.rdfName = rawSchemaBranch && rawSchemaBranch.rdfName;
  }

  public getUri(): string {
    return this.completeSchema.raw.defaultNamespace.uri + this.rdfName;
  }

  public getNamespacedUri(): string {
    return this.completeSchema.raw.defaultNamespace.prefix + ':' + this.rdfName;
  }

  public getName(): string {
    return this.name;
  }
  
  public getRaw() {
    return this.rawSchemaBranch;
  }
  
  public hasDirectRdfRepresentation(): boolean {
    return this.rdfName != null;
  }
}

export class EntityType extends RdfBasedSchemaResource {
	constructor(completeSchema: Schema, name: string) {
    super(completeSchema, completeSchema.raw.entityTypes[name], name);
  }

  public getUri(): string {
    if(this.isElementary()) throw new Error('elementary types don\'t have a URI representation [' + this.getName() + ']');
    return super.getUri();
  }

  public getNamespacedUri(): string {
    if(this.isElementary()) throw new Error('elementary types don\'t have a URI representation [' + this.getName() + ']');
    return super.getUri();
  }

  public isElementary(): boolean {
    return this.getName().substr(0,4) == 'Edm.';
  }

  public getProperty(name: string): Property {
    return new Property(this.completeSchema, this, name);
  }

  public getPropertyNames(): string[] {
    if(this.isElementary()) throw new Error('elementary types don\'t have properties [' + this.getName() + ']');
    return Object.keys(this.getRaw().properties);
  }
}

export class Property extends RdfBasedSchemaResource {
  constructor(completeSchema: Schema, private parentType: EntityType, name: string) {
    super(completeSchema, parentType.getRaw().properties[name], name);
  }

  public getEntityType(): EntityType {
    return this.completeSchema.getEntityType(this.getRaw().type);
  }

  public isNavigationProperty(): boolean {
    return this.getEntityType().isElementary() == false;
  }

  public isQuantityOne(): boolean {
    return this.getRaw().quantity.substr(0,4) === 'one-';
  }

  public isOptional(): boolean {
    return this.getRaw().optional == true;
  }

  public hasInverseProperty(): boolean {
    return this.getRaw().foreignProperty != null;
  }

  public getInverseProperty(): Property {
    var setName = this.getRaw().foreignSet;
    var propName = this.getRaw().foreignProperty;
    return this.completeSchema.getEntitySet(setName).getEntityType().getProperty(propName);
  }

  public mirroredFromProperty(): Property {
    var name = this.getRaw().mirroredFromNavigationProperty;
    return name && new Property(this.completeSchema, this.parentType, this.getRaw().mirroredFromNavigationProperty);
  }
}