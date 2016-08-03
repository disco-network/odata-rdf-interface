declare class Map {
  public set(key, value): void;
  public get(key): any;
  public forEach(fn: (value, key, map: Map) => void): any;
}

export interface IOpenArgsReadonly {
  get<SpecificContract extends IContractImplementer>
    (Contract: ContractSpecification<SpecificContract>): SpecificContract;
  createChild(): IOpenArgs;
}

export interface IOpenArgs extends IOpenArgsReadonly {
  set<SpecificContract extends IContractImplementer>
    (Contract: ContractSpecification<SpecificContract>, instance: SpecificContract);
}

export interface IOpenArgsCompatibilityCheckerReadonly {
  checkCompatibility(args: IOpenArgs, knownContracts: ContractSpecification<any>[]): boolean;
}

export interface IOpenArgsCompatibilityChecker extends IOpenArgsCompatibilityCheckerReadonly {
  setDefaultCondition<SpecificContract extends IContractImplementer>
    (Contract: ContractSpecification<SpecificContract>, condition: (c: SpecificContract) => boolean);
}

export class OpenArgs {

  private map = new Map();

  constructor(private parent?: IOpenArgsReadonly) {
  }

  public get<SpecificContract extends IContractImplementer>
    (Contract: ContractSpecification<SpecificContract>): SpecificContract {
    return this.map.get(Contract);
  }

  public set<SpecificContract extends IContractImplementer>(Contract: ContractSpecification<SpecificContract>,
                                                            instance: SpecificContract) {
    instance.initializeWithPreviousArgs(this.parent);
    this.map.set(Contract, instance);
  }

  public createChild() {
    let ret = new OpenArgs(this as IOpenArgsReadonly);
    this.map.forEach((value, key) => ret.map.set(key, value));
    return ret;
  }
}

export interface IContractImplementer {
  initializeWithPreviousArgs(args: IOpenArgsReadonly);
}

export class ContractSpecification<T extends IContractImplementer> {
  public methodWithContractImplementerReturnType(): T {
    return null;
  }
}

export class OpenArgsCompatibilityChecker implements IOpenArgsCompatibilityChecker {

  private defaultConditions = new Map();

  public checkCompatibility(args: IOpenArgs, knownContracts: ContractSpecification<any>[]): boolean {
    let ret = true;
    this.defaultConditions.forEach((condition, Contract) => {
      if (knownContracts.indexOf(Contract) === -1)
        ret = ret && condition(args.get(Contract));
    });
    return ret;
  }

  public setDefaultCondition<SpecificContract extends IContractImplementer>
    (Contract: ContractSpecification<SpecificContract>, condition: (c: SpecificContract) => boolean) {
    if (this.defaultConditions.get(Contract) === undefined) {
      this.defaultConditions.set(Contract, condition);
    }
    else {
      throw new Error("You can't set a default condition twice.");
    }
  }
}
