"use strict";
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

//# sourceMappingURL=../../maps/src/util.js.map
