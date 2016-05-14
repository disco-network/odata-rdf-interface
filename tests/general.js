var abnfTokenizer = require('../../abnfjs/tokenizer');
var abnfParser = require('../../abnfjs/parser');
var abnfInterpreter = require('../../abnfjs/interpreter');
var fs = require('fs');

module.exports = { name: 'general', tests: [
  { name: 'odata4-mod-abnf', run: function (tools) {
    var abnf = fs.readFileSync('./odata4-mod.abnf', 'utf8');
    var tok = abnfTokenizer.tokenize(abnf);
    var par = abnfParser.parse(tok);
    var inter = new abnfInterpreter.Interpreter(par);
    var result = inter.getCompleteMatch(inter.getPattern('odataRelativeUri'), 'Posts?$filter=$it/a/b/c eq 1');
    console.log(JSON.stringify(result.evaluate(), null, 2)); //TODO: automated tests
  } },
]}