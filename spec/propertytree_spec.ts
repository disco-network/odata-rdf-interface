import propertyTree = require("../src/adapter/propertytree");
import mappings = require("../src/adapter/mappings");
import schema = require("../src/odata/schema");

describe("Property trees", () => {
  it("should avoid duplicate branches", () => {
    let TestBranch = class extends propertyTree.Tree {
      public hash() {
        return "my hash";
      }
      public countBranches() {
        return Object.keys(this.branches).length;
      }
    };
    let tree = new TestBranch();
    let branch = new TestBranch();
    tree.branch(branch);
    tree.branch(branch);

    expect(tree.countBranches()).toBe(1);
  });

  it("should avoid duplicate branches after copying", () => {
    let TestBranch = class extends propertyTree.Tree {
      constructor(private hashStr: string) {
        super();
      }
      public hash() {
        return this.hashStr;
      }
      public countBranches() {
        return Object.keys(this.branches).length;
      }
    };
    let tree1 = new TestBranch("1");
    let tree2 = new TestBranch("2");
    let branch1a = new TestBranch("a");
    let branch2a = new TestBranch("a");
    let branch1a1 = new TestBranch("a/1");
    let branch2a1 = new TestBranch("a/1");
    branch1a.branch(branch1a1);
    tree1.branch(branch1a);
    branch2a.branch(branch2a1);
    tree2.branch(branch2a);

    tree2.copyTo(tree1);

    expect(branch1a.countBranches()).toBe(1);
  });
});

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
