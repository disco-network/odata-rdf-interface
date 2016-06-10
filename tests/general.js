var abnfTokenizer = require('../../abnfjs/tokenizer');
var abnfParser = require('../../abnfjs/parser');
var abnfInterpreter = require('../../abnfjs/interpreter');
var queryFactory = require('../dbqueryfactory');
var fs = require('fs');

module.exports = { name: 'general', tests: [
  { name: 'odata4-mod-filter', run: function (tools) {
    var abnf = fs.readFileSync('../odata4-mod.abnf', 'utf8');
    var tok = abnfTokenizer.tokenize(abnf);
    var par = abnfParser.parse(tok);
    var inter = new abnfInterpreter.Interpreter(par);
    var result = inter.getCompleteMatch(inter.getPattern('odataRelativeUri'), 'Posts?$filter=$it/a/b/c eq 1');
    console.log(JSON.stringify(result.evaluate(), null, 2)); //TODO: automated tests
  } },
  { name: 'odata4-mod-expand', run: function (tools) {
    var abnf = fs.readFileSync('./odata4-mod.abnf', 'utf8');
    var tok = abnfTokenizer.tokenize(abnf);
    var par = abnfParser.parse(tok);
    var inter = new abnfInterpreter.Interpreter(par);
    var result = inter.getCompleteMatch(inter.getPattern('odataRelativeUri'), 'Posts?$expand=Children/ReferredFrom');
    var evaluatedResult = result.evaluate();
    tools.assertTrue(function() { return evaluatedResult.queryOptions.expand.length == 1 });
    tools.assertTrue(function() { return evaluatedResult.queryOptions.expand[0].path[0] == 'Children' });
    tools.assertTrue(function() { return evaluatedResult.queryOptions.expand[0].path[1] == 'ReferredFrom' });
  } },
  { name: 'queryfactory-expandtree', run: function (tools) {
    var expandOption = [ { path: [ "A", "B", "C" ] }, { path: [ "A", "B", "D" ] }, { path: [ "A", "C" ] } ];
    var fty = new queryFactory.QueryComposer('E', { entitySets: { 'E': {} } });
    fty.expand(expandOption);
    tools.assertTrue(function() { return fty.expandTree.A.B.C } );
    tools.assertTrue(function() { return fty.expandTree.A.B.D } );
    tools.assertTrue(function() { return fty.expandTree.A.C } );
  } },
]}
