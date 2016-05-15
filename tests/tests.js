var testPackages = [require('./general'), require('./expand')];

//run from root directory, not from $root/tests

var tools = getTools();

testPackages.forEach(function(pkg) {
  console.log('package ' + pkg.name);
  pkg.tests.forEach(function(t,i) {
    console.log('* test ' + t.name);
    try {
      t.run(tools);
    }
    catch(e) {
      console.log(e.stack);
    }
  });
})

function getTools() {
  return {
    assertTrue: function(predicate, message) {
      var result = (typeof predicate == 'function') ? predicate() : predicate;
      if(!result) throw new Error(message || predicate.toString());
    }
  };
}