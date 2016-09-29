let raw = {
  entityTypes: {
    Post: {
      properties: {
        Id: { autoIncrement_nextValue: 3, type: "Edm.Int32", rdfName: "id", generated: "auto-increment" },
        ContentId: { type: "Edm.Int32", foreignProperty: "Content" },
        ParentId: { type: "Edm.Int32", foreignProperty: "Parent" },
        Parent: { type: "Post", optional: true, quantity: "one-to-many",
          foreignSet: "Posts", inverseProperty: "Children",
          rdfName: "parent" },
        Children: { type: "Post", quantity: "many-to-one", foreignSet: "Posts", inverseProperty: "Parent" },
        Content: { type: "Content", quantity: "one-to-many", rdfName: "content", optional: false },
      },
      rdfName: "Post",
    },
    Content: {
      properties: {
        Id: { autoIncrement_nextValue: 3, type: "Edm.Int32", rdfName: "id", generated: "auto-increment" },
        Title: { type: "Edm.String", rdfName: "title", optional: true },
        Culture: { type: "Culture", quantity: "one-to-many", rdfName: "culture", optional: true },
      },
      rdfName: "Content",
    },
    Culture: {
      properties: {
        Id: { type: "Edm.Int32", rdfName: "id" },
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

export class Schema {
  public raw: any;

  constructor(rawSchema: any = raw) {
    this.raw = rawSchema;
  }

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

  /* @smell this is Sparql, not OData */
  public getNamespacedUri(): string {
    return this.completeSchema.raw.defaultNamespace.prefix + ":" + this.rdfName;
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

  public getNamespacedUri(): string {
    if (this.isElementary())
      throw new Error("elementary types don\'t have a URI representation [" + this.getName() + "]");
    return super.getNamespacedUri();
  }

  public isElementary(): boolean {
    return this.getName().substr(0, 4) === "Edm.";
  }

  public getProperty(name: string): Property {
    return new Property(this.completeSchema, this, name);
  }

  public getPropertyNames(): string[] {
    if (this.isElementary()) throw new Error("elementary types don\'t have properties [" + this.getName() + "]");
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
    return this.getEntityType().isElementary() === false;
  }

  public isCardinalityOne(): boolean {
    return !this.isNavigationProperty() || this.getRaw().quantity.substr(0, 4) === "one-";
  }

  public getEntityKind(): EntityKind {
    return this.isNavigationProperty() ? EntityKind.Complex : EntityKind.Elementary;
  }

  public isOptional(): boolean {
    const foreignProperty = this.foreignProperty();
    if (foreignProperty === undefined) {
      return this.getRaw().optional === true;
    }
    else {
      return foreignProperty.isOptional();
    }
  }

  public isGenerated(): this is { __generatedBrand; } {
    return this.getRaw().generated !== false && this.getRaw().generated !== undefined;
  }

  public getGenerationMethod(this: this & { __generatedBrand; }): GenerationMethod;
  public getGenerationMethod(this: this): GenerationMethod | undefined;
  public getGenerationMethod(): GenerationMethod | undefined {
    if (this.getRaw().generated === "uuid") return GenerationMethod.UUID;
    else if (this.getRaw().generated === "auto-increment") return GenerationMethod.AutoIncrement;
  }

  public isGeneratedUUID(): boolean {
    return this.getRaw().generated === "uuid";
  }

  public isAutoIncrementable(): boolean {
    return this.getRaw().generated === "auto-increment";
  }

  public genNextAutoIncrementValue(): string {
    return (this.getRaw().autoIncrement_nextValue++).toString(10);
  }

  public getInverseProperty(): Property {
    let setName = this.getRaw().foreignSet;
    let propName = this.getRaw().inverseProperty;
    return this.completeSchema.getEntitySet(setName).getEntityType().getProperty(propName);
  }

  public foreignProperty(): Property | undefined {
    let name = this.getRaw().foreignProperty;
    return name && new Property(this.completeSchema, this.parentType, this.getRaw().foreignProperty);
  }
}

export enum EntityKind { Elementary, Complex }
export enum GenerationMethod { UUID, AutoIncrement }
