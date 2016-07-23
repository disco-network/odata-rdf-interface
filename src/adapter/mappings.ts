import schema = require("../odata/schema");

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

  public getSubMappingByLambdaVariable(variable: string, type: schema.EntityType) {
    return new Mapping(
      this.properties.createMappingFromEntityType(type),
      this.variables.getLambdaNamespace(variable)
    );
  }
}

export interface IPropertyMapping {
  getSubMappingByComplexProperty(property: string): IPropertyMapping;
  createMappingFromEntityType(entityType: schema.EntityType): IPropertyMapping;
  getNamespacedUriOfProperty(property: string): string;
  getUriOfProperty(property: string): string;
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

  public getUriOfProperty(property: string) {
    return this.getPropertySchemaWithDirection(property, this.getDirectionOfProperty(property)).getUri();
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
  getVariable(): string;
  getElementaryPropertyVariable(name: string): string;
  getComplexProperty(name: string): IStructuredSparqlVariableMapping;
  getLambdaNamespace(namespaceIdentifier: string): IStructuredSparqlVariableMapping;
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
  private lambdaNamespaces: SparqlVariableMapping<StructuredSparqlVariableMapping>;

  constructor(private variableName: string, vargen: SparqlVariableGenerator) {
    let complexVargen = new ComplexSparqlVariableGenerator(vargen);
    this.elementaryProperties = new SparqlVariableMapping(vargen);
    this.complexProperties = new SparqlVariableMapping(complexVargen);
    this.lambdaNamespaces = new SparqlVariableMapping(complexVargen);
  }

  public getVariable(): string {
    return this.variableName;
  }

  /**
   * Registers an elementary property in this mapping if it does not exist yet
   * and returns the SPARQL variable name.
   */
  public getElementaryPropertyVariable(name: string): string {
    return this.elementaryProperties.getPropertyVariable(name);
  }

  /**
   * Registers a complex property in this mapping if it does not exist yet
   * and returns the structured mapping.
   */
  public getComplexProperty(name: string): StructuredSparqlVariableMapping {
    return this.complexProperties.getPropertyVariable(name);
  }

  /**
   * Registers a lambda namespace whose identifier is the name of the argument
   * passed to the lambda function. Each namespace is another structured mapping.
   */
  public getLambdaNamespace(namespaceIdentifier: string): StructuredSparqlVariableMapping {
    return this.lambdaNamespaces.getPropertyVariable(namespaceIdentifier);
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

  constructor(private vargen: VariableGenerator<Variable>) { }
  public getPropertyVariable(propertyName: string) {
    this.map = this.map || {};
    return this.map[propertyName] = this.map[propertyName] || this.vargen.next();
  }

  public mappingExists(propertyName: string): boolean {
    return this.map != null && this.map[propertyName] != null;
  }

  public forEach(fn: (prop: string, variable: Variable) => void): void {
    for (let key in this.map) {
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
export class ComplexSparqlVariableGenerator implements VariableGenerator<StructuredSparqlVariableMapping> {
  constructor(private vargen: SparqlVariableGenerator) {}
  public next(): StructuredSparqlVariableMapping {
    return new StructuredSparqlVariableMapping(this.vargen.next(), this.vargen);
  }
}

export class SparqlVariableGenerator implements VariableGenerator<string> {
  private i: number = -1;
  public next(): string {
    return "?x" + (++this.i).toString();
  }
}

export interface VariableGenerator<Variable> {
  next(): Variable;
}
