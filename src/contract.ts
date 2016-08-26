/** decorator */
export function conforms(c) {
  return function(target) {
    let contracts: any[] = target.prototype["contracts"] = target.prototype["contracts"] || [];
    if (contracts.indexOf(c) === -1)
      contracts.push(c);
  };
}

export function define<T>(): IContract<T> {
  let contract =  {
    is: (x => {
      return x && x["contracts"] && (x["contracts"] as any[]).indexOf(contract) !== -1;
    }) as ((x) => x is T),
  };
  return contract;
}

export function defineGeneric<FIsContract extends GenericFunction>(): IGenericContract<FIsContract> {
  let contract =  {
    is: (x => {
      return x && x["contracts"] && (x["contracts"] as any[]).indexOf(contract) !== -1;
    }) as FIsContract,
  };
  return contract;
}
export type GenericFunction = <T>(x) => any;

export interface IContract<T> {
  is: (x) => x is T;
}

export interface IGenericContract<FIsContract extends GenericFunction> {
  is: FIsContract;
}
