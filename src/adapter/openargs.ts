declare class Map {
  public set(key, value): void;
  public get(key): any;
  public forEach(fn: (value, key, map: Map) => void): any;
}

export interface IOpenArgsReadonly<Get> {
  get: Get;
  createChild(): IOpenArgs<Get, Get>;
}

export interface IArgsGetter<T extends IContractImplementer<Get>, Get> {
  (contract: IContractSpec<T, Get>): T;
}

export interface IOpenArgs<Get extends ParentGet, ParentGet> extends IOpenArgsReadonly<Get> {
  set<T extends IContractImplementer<ParentGet>>(Contract: IContractSpec<T, ParentGet>,
                                     instance: T): IOpenArgs<Get & ((c: IContractSpec<T, ParentGet>) => T), ParentGet>;
}

export class OpenArgs<Get extends ParentGet, ParentGet> {

  public get = this.getDynamic as any as Get;

  private map = new Map();
  private parent: IOpenArgsReadonly<ParentGet>;

  constructor(parent?: IOpenArgsReadonly<Get>) {
    this.parent = parent;
  }

  public getDynamic<T extends IContractImplementer<ParentGet>>(Contract: IContractSpec<T, ParentGet>): T {
    return this.map.get(Contract);
  }

  public set<T extends IContractImplementer<ParentGet>>(
    Contract: IContractSpec<T, ParentGet>,
    instance: T): IOpenArgs<Get & ((c: IContractSpec<T, ParentGet>) => T), ParentGet> {

    instance.initializeWithPreviousArgs(this.parent);
    this.map.set(Contract, instance);
    return this as any as IOpenArgs<Get & ((c: IContractSpec<T, ParentGet>) => T), ParentGet>;
  }

  public createChild() {
    let ret = new OpenArgs(this as IOpenArgsReadonly<Get>);
    this.map.forEach((value, key) => ret.map.set(key, value));
    return ret;
  }
}

export interface IContractImplementer<ParentGet> {
  initializeWithPreviousArgs(args: IOpenArgsReadonly<ParentGet>);
}

export interface IContractSpec<T extends IContractImplementer<Get>, Get> {
  defaultValue: T;
}

export interface ISimpleContractSpec<Get> extends IContractSpec<IContractImplementer<Get>, Get> {}

export function defContract<T extends IContractImplementer<Get>, Get>(defaultValue?: T): IContractSpec<T, Get> {
  return { defaultValue: defaultValue };
}

export interface IOpenArgsCompatibilityCheckerReadonly {
  checkCompatibility<Get extends ParentGet, ParentGet>
    (args: OpenArgs<Get, ParentGet>, knownContracts: ISimpleContractSpec<any>[]): boolean;
}

export interface IOpenArgsCompatibilityChecker extends IOpenArgsCompatibilityCheckerReadonly {
  setDefaultCondition<SpecificContract extends IContractImplementer<ParentGet>, ParentGet>
    (Contract: IContractSpec<SpecificContract, ParentGet>, condition: (c: SpecificContract) => boolean);
}

export class OpenArgsCompatibilityChecker implements IOpenArgsCompatibilityChecker {

  private defaultConditions = new Map();

  public checkCompatibility<Get extends ParentGet & ParentGet, ParentGet>
    (args: OpenArgs<Get, ParentGet>, knownContracts: ISimpleContractSpec<any>[]): boolean {
    let ret = true;
    this.defaultConditions.forEach((condition, Contract) => {
      if (knownContracts.indexOf(Contract) === -1)
        /* @todo use type guard instead of dynamic? */
        ret = ret && condition(args.getDynamic(Contract));
    });
    return ret;
  }

  public setDefaultCondition<SpecificContract extends IContractImplementer<ParentGet>, ParentGet>
    (Contract: IContractSpec<SpecificContract, ParentGet>, condition: (c: SpecificContract) => boolean) {
    if (this.defaultConditions.get(Contract) === undefined) {
      this.defaultConditions.set(Contract, condition);
    }
    else {
      throw new Error("You can't set a default condition twice.");
    }
  }
}
