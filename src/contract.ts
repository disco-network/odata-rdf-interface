/** decorator */
export function conforms(c) {
  return function(target) {
    target.prototype["contract"] = c;
  };
}

export function define<T>(expectedType = {}): IContract<T> {
  let contract =  {
    is: (x => {
      return x && x["contract"] === contract;
    }) as ((x) => x is T),
  };
  return contract;
}

export interface IContract<T> {
  is: (x) => x is T;
}
