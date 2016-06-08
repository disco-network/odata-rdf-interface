var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    __.prototype = b.prototype;
    d.prototype = new __();
};

var notImplemented = function() { throw new Error('not implemented') }

Factory = defClass(null,
function Factory() { },
{
  create: notImplemented
});

function defClass(sup, ctor, props) {
  if(sup) __extends(ctor, sup);
  for(var i in props) ctor.prototype[i] = props[i];
  return ctor;
}

function mergeArrays(arrays) {
  return [].concat.apply([], arrays);
}

module.exports = {
  defClass: defClass,
  notImplemented: notImplemented,
  mergeArrays: mergeArrays,
  Factory: Factory,
};
