export interface IRawSchema {
  entityTypes: {
    [name: string]: IRawEntityType;
  };

  entitySets: {
    [name: string]: { type: string; }
  };

  defaultNamespace: {
    prefix: "disco";
    uri: "http://disco-network.org/resource/";
  };
}

export interface IRawEntityType {
  properties: {
    [name: string]: IRawProperty;
  };
  rdfName: string;
}

export type IRawProperty = {
  type: string;
  rdfName: string;
  /** default: false */
  optional?: boolean;
  /** default: false */
  isArray?: boolean;
  generated?: "auto-increment" | "uuid";
  autoIncrement_nextValue?: number;
  inverseProperty?: undefined;
  foreignSet?: undefined;
  foreignProperty?: undefined;
} |
  {
    type: string;
    /** complex (navigation) property belonging to the foreign-key property */
    foreignProperty: string;
    isArray?: false;
    optional?: undefined;
    generated?: undefined | false;
    autoIncrement_nextValue?: undefined;
    inverseProperty?: undefined;
    foreignSet?: undefined;
  } |
  {
    type: string;
    inverseProperty: string;
    foreignSet: string;
    optional?: boolean;
    isArray?: boolean;
    generated?: undefined | false;
    autoIncrement_nextValue?: undefined;
    foreignProperty?: undefined;
  }

const raw: IRawSchema = {
  entityTypes: {
    Post: {
      properties: {
        Id: { autoIncrement_nextValue: 3, type: "Edm.Int32", rdfName: "id", generated: "auto-increment" },
        ContentId: { type: "Edm.Int32", foreignProperty: "Content" },
        ParentId: { type: "Edm.Int32", foreignProperty: "Parent" },
        Parent: {
          type: "Post", optional: true,
          rdfName: "parent",
        },
        Children: { type: "Post", isArray: true, inverseProperty: "Parent", foreignSet: "Posts" },
        Content: { type: "Content", rdfName: "content", optional: false },
      },
      rdfName: "Post",
    },
    Content: {
      properties: {
        Id: { autoIncrement_nextValue: 3, type: "Edm.Int32", rdfName: "id", generated: "auto-increment" },
        Title: { type: "Edm.String", rdfName: "title", optional: true },
        Culture: { type: "Culture", rdfName: "culture", optional: true },
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
    Culture: {
      type: "Culture",
    },
  },
  defaultNamespace: {
    prefix: "disco",
    uri: "http://disco-network.org/resource/",
  },
};

export class Schema {
  public raw: IRawSchema;

  constructor(rawSchema: IRawSchema = raw) {
    this.raw = rawSchema;
  }

  public getEntitySet(name: string): EntitySet {
    return new EntitySet(this, name);
  }

  public getEntitySetOfType(type: EntityType): EntitySet {
    const names = Object.keys(this.raw.entitySets);
    for (const name of names) {
      if (this.raw.entitySets[name].type === type.getName())
        return this.getEntitySet(name);
    }
    throw new Error(`No EntitySet found for type ${type.getName()}`);
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

  public getName(): string {
    return this.name;
  }

  public getEntityType(): EntityType {
    return this.completeSchema.getEntityType(this.getEntityTypeName());
  }

  public getEntityTypeName(): string {
    return this.completeSchema.raw.entitySets[this.name].type;
  }

  public getEntityUri(): string {
    return this.completeSchema.raw.defaultNamespace.uri;
  }
}

export class RdfBasedSchemaResource<T extends { rdfName?: string }> {
  private rdfName: string | undefined;

  constructor(protected completeSchema: Schema, private rawSchemaBranch: T, private name: string) {
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

export class EntityType extends RdfBasedSchemaResource<IRawEntityType> {
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
    if (Object.prototype.hasOwnProperty.call(this.getRaw().properties, name))
      return new Property(this.completeSchema, this, name);
    else throw new Error(`Property ${name} does not exist on type ${this.getName()}!`);
  }

  public getPropertyNames(): string[] {
    if (this.isElementary()) throw new Error("elementary types don\'t have properties [" + this.getName() + "]");
    return Object.keys(this.getRaw().properties);
  }

  public getEntitySet(): EntitySet {
    return this.completeSchema.getEntitySetOfType(this);
  }
}

export class Property extends RdfBasedSchemaResource<IRawProperty> {
  constructor(completeSchema: Schema, private parentType: EntityType, name: string) {
    super(completeSchema, parentType.getRaw().properties[name], name);
  }

  public getEntityType(): EntityType {
    return this.completeSchema.getEntityType(this.getRaw().type);
  }

  public isNavigationProperty(): boolean {
    return this.getEntityType().isElementary() === false;
  }

  public isMultiplicityOne(): boolean {
    return !this.isNavigationProperty() || this.getRaw().isArray !== true;
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
    if (setName !== undefined && propName !== undefined)
      return this.completeSchema.getEntitySet(setName).getEntityType().getProperty(propName);
    else
      throw new Error(`Could not find inverse property of ${this.getName()}`);
  }

  public foreignProperty(): Property | undefined {
    let name = this.getRaw().foreignProperty;
    if (name !== undefined) return new Property(this.completeSchema, this.parentType, name);
    else return undefined;
  }
}

export enum EntityKind { Elementary, Complex }
export enum GenerationMethod { UUID, AutoIncrement }
