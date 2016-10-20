import { assert } from "chai";

import propertyTree = require("../src/adapter/propertytree/propertytree");
import mappings = require("../src/adapter/mappings");
import schema = require("../src/odata/schema");

describe("Property trees", () => {
  it("should avoid duplicate branches", () => {
    let counter = 0;
    let TestBranch = class implements propertyTree.INode {
      public hash() {
        return "my hash";
      }
      public apply(): any {
        ++counter;
      }
    };
    let tree = new propertyTree.Tree();
    let branch = new TestBranch();
    tree.branchNode(branch);
    tree.branchNode(branch);
    tree.traverse({} as any);

    assert.strictEqual(counter, 1);
  });

  it("should avoid duplicate branches after copying", () => {
    let counter = 0;
    class TestBranch extends propertyTree.Tree {
      constructor(private hashStr: string, private count: boolean = false) {
        super();
      }
      public hash() {
        return "my hash";
      }
      public apply(): any {
        if (this.count) ++counter;
        return {};
      }
    }
    let tree1 = new propertyTree.Tree();
    let tree2 = new propertyTree.Tree();
    let branch1a = new propertyTree.Tree(new TestBranch("a", true));
    let branch2a = new propertyTree.Tree(new TestBranch("a", true));
    let branch1a1 = new TestBranch("a/1");
    let branch2a1 = new TestBranch("a/1");
    branch1a.branchNode(branch1a1);
    tree1.branchTree(branch1a);
    branch2a.branchNode(branch2a1);
    tree2.branchTree(branch2a);

    tree2.copyTo(tree1);
    tree1.traverse({} as any);

    assert.strictEqual(counter, 1);
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
