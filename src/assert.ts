export { assert } from "chai";

const functionBrand = {};

function isMatchFunction(val): val is { type: {}; match: (value) => boolean } {
  return val && val.type === functionBrand;
}

export const match = {
  any: { type: functionBrand, match: (value) => true },
  is: function(predicate: (value) => boolean) {
    return { type: functionBrand, match: predicate, toString: () => `[match ${predicate.toString()}]` }; },
};

export const assertEx = {
  deepEqual: function(lhs, rhs) {
    if (!doesDeepEqual(lhs, rhs)) {
      throw new Error(`expected lhs to deeply equal rhs
lhs: ${JSON.stringify(lhs, (k,v) => hasPropDirectlyOrInPrototype(v, "toString") 
  ? (v.toString() !== "[object Object]" ? v.toString() : v)
  : v, 2)}
rhs: ${JSON.stringify(rhs, (k,v) => hasPropDirectlyOrInPrototype(v, "toString") 
  ? (v.toString() !== "[object Object]" ? v.toString() : v)
  : v, 2)}`);
    }
  },
};

function hasPropDirectlyOrInPrototype(obj, prop: string) {
  return hasProp(obj, prop) || (obj && hasProp(obj.__proto__, prop));
}

function hasProp(obj, prop: string) {
  return obj && Object.prototype.hasOwnProperty.call(obj, prop);
}

function doesDeepEqual(lhs, rhs): boolean {
  if (isMatchFunction(rhs)) return rhs.match(lhs);

  switch (typeof lhs) {
    case "string":
    case "number":
    case "symbol":
    case "function":
    case "undefined":
      return lhs === rhs;
    case "object":
      for (const prop of Object.keys(lhs)) {
        if (!Object.prototype.hasOwnProperty.call(rhs, prop) || !doesDeepEqual(lhs[prop], rhs[prop]))
          return false;
      }
      for (const prop of Object.keys(rhs)) {
        if (!Object.prototype.hasOwnProperty.call(lhs, prop) || !doesDeepEqual(lhs[prop], rhs[prop]))
          return false;
      }
      return true;
    default:
      return false;
  }
}
