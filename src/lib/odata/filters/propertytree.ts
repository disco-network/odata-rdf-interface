export class ScopedPropertyTree {

  public static fromDataObjects(root: any, inScopeVariables: any = {}) {
    return this.create(FlatPropertyTree.fromDataObject(root), FlatPropertyTree.fromDataObject(inScopeVariables));
  }

  public static create(root = FlatPropertyTree.empty(), inScopeVariables = FlatPropertyTree.empty()) {
    return new ScopedPropertyTree(root, inScopeVariables);
  }

  public root: FlatPropertyTree;
  public inScopeVariables: FlatPropertyTree;

  constructor(root = FlatPropertyTree.empty(), inScopeVariables = FlatPropertyTree.empty()) {
    this.root = root;
    this.inScopeVariables = inScopeVariables;
  }

  public merge(other: ScopedPropertyTree) {
    this.root.merge(other.root);
    this.inScopeVariables.merge(other.inScopeVariables);
  }
}

export class FlatPropertyTree {

  public static empty() {
    return this.fromDataObject({});
  }

  public static fromDataObject(data: IFlatPropertyTreeDataObject) {
    let tree = new FlatPropertyTree();
    tree.data = {};
    for (let property of Object.keys(data)) {
      tree.data[property] = FlatPropertyTree.fromDataObject(data[property]);
    }
    return tree;
  }

  private data: { [id: string]: FlatPropertyTree };

  public createBranch(property: string) {
    return this.data[property] = this.data[property] || FlatPropertyTree.fromDataObject({});
  }

  public getBranch(property: string) {
    if (this.branchExists(property))
      return this.data[property];
    else
      throw new Error("branch " + property + " does not exist");
  }

  public branchExists(property: string) {
    return this.data[property] !== undefined;
  }

  /**
   * Return an iterator object whose current() method returns the first item.
   * Calling next() will make the iterator step forward and return item 2 etc.
   */
  public getIterator(): IIterator<string> {
    let properties = Object.keys(this.data);
    let i = 0;
    return { current: () => properties[i], next: () => properties[++i], hasValue: () => properties.length > i };
  }

  public clone() {
    let cloned = FlatPropertyTree.empty();
    cloned.merge(this);
    return cloned;
  }

  public merge(other: FlatPropertyTree) {
    for (let it = other.getIterator(), property = it.current(); it.hasValue(); it.next()) {
      let branch = this.createBranch(property);
      branch.merge(other.getBranch(property));
    }
  }

  public toDataObject() {
    let ret: IFlatPropertyTreeDataObject = {};
    for (let it = this.getIterator(); it.hasValue(); it.next()) {
      ret[it.current()] = this.getBranch(it.current()).toDataObject();
    }
    return ret;
  }
}

export interface IFlatPropertyTreeDataObject {
  [id: string]: IFlatPropertyTreeDataObject;
}

export interface IIterator<T> {
  current(): T;
  next(): T;
  hasValue(): boolean;
}
