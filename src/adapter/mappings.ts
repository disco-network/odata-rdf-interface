import schema = require("../odata/schema");
import { UniqueScopeIdentifier } from "../odata/filters/filters";
import { VariableWithSyntax, VariableNameOnly } from "../sparql/querystringproducer";

declare class Map<Key, Value> {
  public set(key: Key, value: Value);
  public get(key: Key): Value;
  public has(key: Key): boolean;
};

export class ScopedMapping {
  private root: Mapping;
  private parent: ScopedMapping | undefined;
  private namespaces: { [id: string]: Mapping };
  private scopes = new Map<UniqueScopeIdentifier, ScopedMapping>();

  constructor(root: Mapping, parent?: ScopedMapping) {
    this.root = root;
    this.parent = parent;
    this.namespaces = {};
  }

  public unscoped(): Mapping {
    return this.root;
  }

  public getNamespace(name: string): Mapping {
    if (!Object.prototype.hasOwnProperty.call(this.namespaces, name)) {
      if (this.parent !== undefined) return this.parent.getNamespace(name);
      else throw new Error("namespace not found");
    }
    return this.namespaces[name];
  }

  public setNamespace(name: string, entityType: schema.EntityType) {
    this.namespaces[name] = new Mapping(
      this.root.properties.createMappingFromEntityType(entityType),
      this.root.variables.createNew()
    );
  }

  public scope(id: UniqueScopeIdentifier) {
    if (!this.scopes.has(id)) this.scopes.set(id, new ScopedMapping(this.root, this));
    return this.scopes.get(id);
  }
}

/**
 * Maps OData structure to Sparql structure.
 * See PropertyMapping and StructuredSparqlVariableMapping.
 */
export class Mapping {
  public properties: IPropertyMapping;
  public variables: IStructuredSparqlVariableMapping;

  constructor(propertyMapping: IPropertyMapping, variableMapping: IStructuredSparqlVariableMapping) {
    this.properties = propertyMapping;
    this.variables = variableMapping;
  }

  public getSubMappingByComplexProperty(property: string) {
    return new Mapping(
      this.properties.getSubMappingByComplexProperty(property),
      this.variables.getComplexProperty(property)
    );
  }
}

export interface IPropertyMapping {
  getSubMappingByComplexProperty(property: string): IPropertyMapping;
  createMappingFromEntityType(entityType: schema.EntityType): IPropertyMapping;
  getNamespacedUriOfProperty(property: string): string;
  getDirectionOfProperty(property: string): PropertyDirection;
}

/**
 * Maps OData property strings to Sparql Uris.
 */
export class PropertyMapping implements IPropertyMapping {
  constructor(private entityType: schema.EntityType) {
  }

  public getSubMappingByComplexProperty(property: string) {
    let type = this.getPropertySchema(property).getEntityType();
    return new PropertyMapping(type);
  }

  public getNamespacedUriOfProperty(property: string) {
    return this.getPropertySchemaWithDirection(property, this.getDirectionOfProperty(property)).getNamespacedUri();
  }

  public getDirectionOfProperty(property: string): PropertyDirection {
    return this.getPropertySchema(property).hasDirectRdfRepresentation() ?
      PropertyDirection.Direct : PropertyDirection.Inverse;
  }

  public createMappingFromEntityType(entityType: schema.EntityType): IPropertyMapping {
    return new PropertyMapping(entityType);
  }

  private getPropertySchema(property: string) {
    return this.entityType.getProperty(property);
  }

  private getInversePropertySchema(property: string) {
    return this.getPropertySchema(property).getInverseProperty();
  }

  private getPropertySchemaWithDirection(property: string, direction: PropertyDirection) {
    switch (direction) {
      case PropertyDirection.Direct:
        return this.getPropertySchema(property);
      case PropertyDirection.Inverse:
        return this.getInversePropertySchema(property);
      default:
        throw new Error("invalid property direction " + direction);
    }
  }
}

export enum PropertyDirection {
  Direct, Inverse
}

export interface IStructuredSparqlVariableMapping {
  createNew(): IStructuredSparqlVariableMapping;
  getVariable(): string;
  getElementaryPropertyVariable(name: string): string;
  getComplexProperty(name: string): IStructuredSparqlVariableMapping;
  elementaryPropertyExists(name: string): boolean;
  complexPropertyExists(name: string): boolean;
  forEachElementaryProperty(fn: (prop: string, variable: string) => void): void;
  forEachComplexProperty(fn: (prop: string, variable: IStructuredSparqlVariableMapping) => void): void;
  isEmpty(): boolean;
}

/**
 * Maps an OData property hierarchy to the corresponding SPARQL variables.
 * Additionally, we use it to remember which properties will show up in the
 * query result.
 */
export class StructuredSparqlVariableMapping implements IStructuredSparqlVariableMapping {
  private elementaryProperties: SparqlVariableMapping<string>;
  private complexProperties: SparqlVariableMapping<StructuredSparqlVariableMapping>;

  constructor(private variableName: string, private vargen: SparqlVariableGenerator) {
    let complexVargen = new ComplexSparqlVariableGenerator(vargen);
    this.elementaryProperties = new SparqlVariableMapping(vargen);
    this.complexProperties = new SparqlVariableMapping(complexVargen);
  }

  public createNew(): IStructuredSparqlVariableMapping {
    return new StructuredSparqlVariableMapping(this.vargen.next(), this.vargen);
  }

  /* @smell migrate to getVariableWithoutSyntax - no SPARQL abstraction leak */
  public getVariable(): string & VariableWithSyntax {
    return this.variableName as string & VariableWithSyntax;
  }

  public getVariableWithoutSyntax(): string & VariableNameOnly {
    const withSyntax = this.getVariable();
    return withSyntax.substr(1) as string & VariableNameOnly;
  }

  /**
   * Registers an elementary property in this mapping if it does not exist yet
   * and returns the SPARQL variable name.
   */
  public getElementaryPropertyVariable(name: string): string & VariableWithSyntax {
    return this.elementaryProperties.getPropertyVariable(name);
  }

  /**
   * Registers an elementary property in this mapping if it does not exist yet
   * and returns the SPARQL variable name.
   */
  public getElementaryPropertyVariableWithoutSyntax(name: string): string & VariableNameOnly {
    return this.elementaryProperties.getPropertyVariable(name);
  }

  /**
   * Registers a complex property in this mapping if it does not exist yet
   * and returns the structured mapping.
   */
  public getComplexProperty(name: string): StructuredSparqlVariableMapping {
    return this.complexProperties.getPropertyVariable(name);
  }

  public elementaryPropertyExists(name: string): boolean {
    return this.elementaryProperties.mappingExists(name);
  }

  public complexPropertyExists(name: string): boolean {
    return this.complexProperties.mappingExists(name);
  }

  public forEachElementaryProperty(fn: (prop: string, variable: string) => void): void {
    this.elementaryProperties.forEach(fn);
  }

  public forEachComplexProperty(fn: (prop: string, variable: IStructuredSparqlVariableMapping) => void): void {
    this.complexProperties.forEach(fn);
  }

  public isEmpty(): boolean {
    return this.elementaryProperties.isEmpty() && this.complexProperties.isEmpty();
  }
}

/**
 * Maps property names to their unique SPARQL variable name.
 */
export class SparqlVariableMapping<Variable> {
  private map: Object;

  constructor(private vargen: IVariableGenerator<Variable>) { }
  public getPropertyVariable(propertyName: string) {
    this.map = this.map || {};
    return this.map[propertyName] = this.map[propertyName] || this.vargen.next();
  }

  public mappingExists(propertyName: string): boolean {
    return this.map != null && this.map[propertyName] != null;
  }

  public forEach(fn: (prop: string, variable: Variable) => void): void {
    for (let key of Object.keys(this.map)) {
      fn(key, this.map[key]);
    }
  }

  public isEmpty(): boolean {
    return this.map == null || Object.keys(this.map).length === 0;
  }
}

/**
 * Generates instances of StructuredSparqlVariableMapping.
 */
export class ComplexSparqlVariableGenerator implements IVariableGenerator<StructuredSparqlVariableMapping> {
  constructor(private vargen: SparqlVariableGenerator) {}
  public next(): StructuredSparqlVariableMapping {
    return new StructuredSparqlVariableMapping(this.vargen.next(), this.vargen);
  }
}

export class SparqlVariableGenerator implements IVariableGenerator<string> {
  private i: number = -1;
  public next(): string {
    return "?x" + (++this.i).toString();
  }
}

export interface IVariableGenerator<Variable> {
  next(): Variable;
}
