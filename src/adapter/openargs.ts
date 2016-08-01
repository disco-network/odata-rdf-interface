declare class Map {
  public set(key, value): void;
  public get(key): any;
  public forEach(fn: (value, key, map: Map) => void): any;
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

export interface OpenArgsCompatibilityCheckerReadonly {
  checkCompatibility(args: OpenArgs, knownContracts: ContractSpecification<any>[]): boolean;
}

export interface OpenArgsCompatibilityChecker extends OpenArgsCompatibilityCheckerReadonly {
  setDefaultCondition<SpecificContract extends ContractImplementer>
    (Contract: ContractSpecification<SpecificContract>, condition: (c: SpecificContract) => boolean);
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

export class OpenArgsCompatibilityCheckerImpl implements OpenArgsCompatibilityChecker {

  private defaultConditions = new Map();

  public checkCompatibility(args: OpenArgs, knownContracts: ContractSpecification<any>[]): boolean {
    let ret = true;
    this.defaultConditions.forEach((condition, Contract) => {
      if (knownContracts.indexOf(Contract) === -1)
        ret = ret && condition(args.get(Contract));
    });
    return ret;
  }

  public setDefaultCondition<SpecificContract extends ContractImplementer>
    (Contract: ContractSpecification<SpecificContract>, condition: (c: SpecificContract) => boolean) {
    if (this.defaultConditions.get(Contract) === undefined) {
      this.defaultConditions.set(Contract, condition);
    }
    else {
      throw new Error("You can't set a default condition twice.");
    }
  }
}
