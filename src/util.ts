export interface Factory {
  create(): any;
}

export function mergeArrays(arrays) {
  return [].concat.apply([], arrays);
}

export function values(dict) {
  return Object.keys(dict).map(function(k) { return dict[k] });
}
