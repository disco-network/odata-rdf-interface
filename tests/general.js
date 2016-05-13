var abnfTokenizer = require('../../abnfjs/tokenizer');
var abnfParser = require('../../abnfjs/parser');
var abnfInterpreter = require('../../abnfjs/interpreter');

module.exports = { name: 'general', tests: [
  function (tools) {
    tools.assertTrue(function() { 1 == 2 });
  }
]}