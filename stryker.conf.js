module.exports = function(config){
  config.set({
    files: [
        { pattern: 'lib/src/**/*.js', mutated: true, included: false},
        'lib/spec/**/*.js'
    ],
    testRunner: 'mocha',
    testFramework: 'mocha',
    reporter: ['clear-text', 'progress']
  });
}