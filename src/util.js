"use strict";
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b)
        if (b.hasOwnProperty(p))
            d[p] = b[p];
    function __() { this.constructor = d; }
    __.prototype = b.prototype;
    d.prototype = new __();
};
var notImplemented = function () { throw new Error('not implemented'); };
/*export function defClass(sup, ctor, props) {
  if(sup) __extends(ctor, sup);
  for(var i in props) ctor.prototype[i] = props[i];
  return ctor;
}*/
function mergeArrays(arrays) {
    return [].concat.apply([], arrays);
}
exports.mergeArrays = mergeArrays;
function values(dict) {
    return Object.keys(dict).map(function (k) { return dict[k]; });
}
exports.values = values;
function multiSwitch(values, cases) {
    for (var i in cases) {
        var c = cases[i];
        var match = true;
        for (var j in values) {
            if (values[j] !== cases.conditions[j])
                match = false;
        }
        if (match)
            cases.do();
    }
}
exports.multiSwitch = multiSwitch;

//# sourceMappingURL=../maps/src/util.js.map
