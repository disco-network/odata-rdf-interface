declare function describe(...args);
declare function it(...args);
declare function xit(...args);

declare module "chai" {
  export function expect(...args);
  export let assert: {
    equal(x, y): void;
    strictEqual(x, y): void;
    notStrictEqual(x, y): void;
    deepEqual(x, y): void;
    includeDeepMembers<T>(superset: T[], subset: T[]): void;
    throws(fn: () => void): void;
    isDefined(x): void;
    isUndefined(x): void;
    isAbove(x, y);
  };
}