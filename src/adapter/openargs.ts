declare class Map {
  public set(key, value): void;
  public get(key): any;
  public forEach(fn: (key, value, map: Map) => void): any;
}

export interface OpenArgsReadonly {
  get<SpecificContract extends ContractImplementer>
    (Contract: ContractSpecification<SpecificContract>): SpecificContract;
  createChild(): OpenArgs;
}

export interface OpenArgs extends OpenArgsReadonly {
  set<SpecificContract extends ContractImplementer>
    (Contract: ContractSpecification<SpecificContract>, instance: SpecificContract);
}

export class OpenArgsImpl {

  private map = new Map();

  constructor(private parent?: OpenArgsReadonly) {
  }

  public get<SpecificContract extends ContractImplementer>
    (Contract: ContractSpecification<SpecificContract>): SpecificContract {
    return this.map.get(Contract);
  }

  public set<SpecificContract extends ContractImplementer>(Contract: ContractSpecification<SpecificContract>,
                                                           instance: SpecificContract) {
    instance.initializeWithPreviousArgs(this.parent);
    this.map.set(Contract, instance);
  }

  public createChild() {
    let ret = new OpenArgsImpl(this as OpenArgsReadonly);
    this.map.forEach((value, key) => ret.map.set(key, value));
    return ret;
  }
}

export interface ContractImplementer {
  initializeWithPreviousArgs(args: OpenArgsReadonly);
}

export class ContractSpecification<T extends ContractImplementer> {
  public methodWithContractImplementerReturnType(): T {
    return null;
  }
}
