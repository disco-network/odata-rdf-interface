import propertyTrees = require("../src/adapter/propertytree");
import gpatterns = require("../src/sparql/graphpatterns");
import mappings = require("../src/adapter/mappings");
import schema = require("../src/odata/schema");

class TestPatternSelector implements propertyTrees.GraphPatternSelector {
  constructor(private selectFn: (args: propertyTrees.BranchingArgs) => gpatterns.TreeGraphPattern) {
  }

  public select(args: propertyTrees.BranchingArgs) {
    return this.selectFn(args);
  }

  public getOtherSelector(pattern: gpatterns.TreeGraphPattern) {
    return notImplemented();
  }
}

class TestMapping extends mappings.Mapping {
  public properties: TestPropertyMapping;
  public variables: TestVariableMapping;

  constructor() {
    super(new TestPropertyMapping(), new TestVariableMapping());
  }
}

class TestVariableMapping implements mappings.IStructuredSparqlVariableMapping {

  public createNew() {
    return new TestVariableMapping();
  }

  public getVariable() {
    return "?root";
  }

  public getElementaryPropertyVariable(name: string): string {
    return "?" + name;
  }

  public getComplexProperty(name: string): mappings.IStructuredSparqlVariableMapping {
    return notImplemented();
  }

  public getLambdaNamespace(namespaceIdentifier: string): mappings.IStructuredSparqlVariableMapping {
    return notImplemented();
  }

  public elementaryPropertyExists(name: string): boolean {
    return true;
  }

  public complexPropertyExists(name: string): boolean {
    return false;
  }

  public forEachElementaryProperty(fn: (prop: string, variable: string) => void): void {
    return notImplemented();
  }

  public forEachComplexProperty(fn: (prop: string, variable: mappings.IStructuredSparqlVariableMapping) => void): void {
    return notImplemented();
  }

  public isEmpty(): boolean {
    return notImplemented();
  };
}

class TestPropertyMapping implements mappings.IPropertyMapping {
  public getSubMappingByComplexProperty(property: string): mappings.IPropertyMapping {
    return notImplemented();
  }

  public createMappingFromEntityType(entityType: schema.EntityType): mappings.IPropertyMapping {
    return notImplemented();
  }

  public getNamespacedUriOfProperty(property: string): string {
    return "ns:" + property;
  }

  public getUriOfProperty(property: string): string {
    return "http://example.org/#" + property;
  }

  public getDirectionOfProperty(property: string): mappings.PropertyDirection {
    return mappings.PropertyDirection.Direct;
  }
}

function notImplemented(): any {
  throw new Error("not implemented");
}
