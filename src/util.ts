export interface Factory {
  create(): any;
}

/*export function defClass(sup, ctor, props) {
  if(sup) __extends(ctor, sup);
  for(var i in props) ctor.prototype[i] = props[i];
  return ctor;
}*/

export function mergeArrays(arrays) {
  return [].concat.apply([], arrays);
}

export function values(dict) {
  return Object.keys(dict).map(function(k) { return dict[k] });
}

export function multiSwitch(values, cases) {
  for (let i in cases) {
    let match = true;
    for (let j in values) {
      if (values[j] !== cases.conditions[j]) match = false;
    }
    if (match) cases.do();
  }
}
