/** @module */

/**
 * Maps an OData property hierarchy to the corresponding SPARQL variables.
 * Additionally, we use it to remember which properties will show up in the
 * query result.
 */
export class StructuredSparqlVariableMapping {
  private elementaryProperties: SparqlVariableMapping<string>;
  private complexProperties: SparqlVariableMapping<StructuredSparqlVariableMapping>;

  constructor(private variableName: string, vargen: SparqlVariableGenerator) {
    let complexVargen = new ComplexSparqlVariableGenerator(vargen);
    this.elementaryProperties = new SparqlVariableMapping(vargen);
    this.complexProperties = new SparqlVariableMapping(complexVargen);
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
   * Registers an complex property in this mapping if it does not exist yet
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

  public forEachComplexProperty(fn: (prop: string, variable: StructuredSparqlVariableMapping) => void): void {
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
