var pkgGeneral = require('./general');
var testPackages = [pkgGeneral];


var tools = getTools();

testPackages.forEach(function(pkg) {
  console.log('Package: ', pkg.name);
  pkg.tests.forEach(function(t,i) {
    console.log('test #' + i);
    try {
      t(tools);
    }
    catch(e) {
      console.error(e);
    }
  });
})

function getTools() {
  return {
    assertTrue: function(predicate) {
      if(!predicate()) throw new Error(predicate.toString());
    }
  };
}