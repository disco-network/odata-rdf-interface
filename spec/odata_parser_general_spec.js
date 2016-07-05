"use strict";
var abnfTokenizer = require('abnfjs/tokenizer');
var abnfParser = require('abnfjs/parser');
var abnfInterpreter = require('abnfjs/interpreter');
var fs = require('fs');
describe("odata parser", function () {
    it("should parse an OData filter expression", function () {
        var parser = initODataParser();
        var result = parser.getCompleteMatch(parser.getPattern('odataRelativeUri'), 'Posts?$filter=$it/a/b/c eq 1');
        var evaluated = result.evaluate();
        expect(evaluated.queryOptions).toBeDefined();
        expect(evaluated.queryOptions.filter).toBeDefined();
        expect(evaluated.queryOptions.filter.type).toEqual('operator');
        expect(evaluated.queryOptions.filter.lhs.type).toEqual('member-expression');
        expect(evaluated.queryOptions.filter.rhs.type).toEqual('decimalValue');
        //console.log(JSON.stringify(evaluated, null, 2));
    });
    it("should parse an OData expand expression", function () {
        var parser = initODataParser();
        var result = parser.getCompleteMatch(parser.getPattern('odataRelativeUri'), 'Posts?$expand=Children/ReferredFrom').evaluate();
        expect(result.queryOptions.expand.length).toEqual(1);
        expect(result.queryOptions.expand[0].path[0]).toEqual('Children');
        expect(result.queryOptions.expand[0].path[1]).toEqual('ReferredFrom');
    });
    function initODataParser() {
        var abnf = fs.readFileSync('./src/odata/odata4-mod.abnf', 'utf8');
        var tok = abnfTokenizer.tokenize(abnf);
        var par = abnfParser.parse(tok);
        var inter = new abnfInterpreter.Interpreter(par);
        return inter;
    }
});
