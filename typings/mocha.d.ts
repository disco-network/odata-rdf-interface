declare function describe(...args);
declare function it(...args);
declare function xit(...args);

declare module "chai" {
  export function expect(...args);
  export let assert: {
    equal(x, y): void;
    strictEqual(x, y, msg?: string): void;
    notStrictEqual(x, y): void;
    deepEqual(x, y): void;
    includeDeepMembers<T>(superset: T[], subset: T[]): void;
    throws(fn: () => void): void;
    isDefined(x): void;
    isUndefined(x): void;
    isAbove(x, y);
  };
}

declare module "sinon" {
  export function stub(): IStub;
  export function stub(object: any, name: string, fn?: Function): IStub;
  export let match: IMatch;

  export interface IStub extends PrivateIStub {
  }

  export type IMatch = { any; } & ((x) => any);
}

interface PrivateIStub extends Function {
  returns(value): this;
  callsArgWith(index: number, ...args): this;
  throws(name?: string): this;
  withArgs(...args): this;
  calledOnce: boolean;
}
