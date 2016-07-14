"use strict";
var abnfTokenizer = require("abnfjs/tokenizer");
var abnfParser = require("abnfjs/parser");
var abnfInterpreter = require("abnfjs/interpreter");
var fs = require("fs");
describe("odata parser", function () {
    it("should parse an OData filter expression", function () {
        var parser = initODataParser();
        var result = parser.getCompleteMatch(parser.getPattern("odataRelativeUri"), "Posts?$filter=$it/a/b/c eq 1");
        var evaluated = result.evaluate();
        expect(evaluated.queryOptions).toBeDefined();
        expect(evaluated.queryOptions.filter).toBeDefined();
        expect(evaluated.queryOptions.filter.type).toEqual("operator");
        expect(evaluated.queryOptions.filter.lhs.type).toEqual("member-expression");
        expect(evaluated.queryOptions.filter.rhs.type).toEqual("decimalValue");
    });
    it("should parse an OData expand expression", function () {
        var parser = initODataParser();
        var result = parser.getCompleteMatch(parser.getPattern("odataRelativeUri"), "Posts?$expand=Children/ReferredFrom").evaluate();
        expect(result.queryOptions.expand.length).toEqual(1);
        expect(result.queryOptions.expand[0].path[0]).toEqual("Children");
        expect(result.queryOptions.expand[0].path[1]).toEqual("ReferredFrom");
    });
    it("should parse a simple filter expression", function () {
        var parser = initODataParser();
        var result = parser.getCompleteMatch(parser.getPattern("odataRelativeUri"), "Posts?$filter='2' eq '1'").evaluate();
        var filterOption = result.queryOptions.filter;
        expect(filterOption.type).toBe("operator");
        expect(filterOption.op).toBe("eq");
        expect(filterOption.rhs.type).toBe("string");
        expect(filterOption.rhs.value).toBe("1");
    });
    it("should parse a simple member expression", function () {
        var parser = initODataParser();
        var result = parser.getCompleteMatch(parser.getPattern("odataRelativeUri"), "Posts?$filter=Id eq '1'").evaluate();
        var filterOption = result.queryOptions.filter;
        expect(filterOption.lhs.type).toBe("member-expression");
        expect(filterOption.lhs.path.propertyName).toBe("Id");
    });
    function initODataParser() {
        var abnf = fs.readFileSync("./src/odata/odata4-mod.abnf", "utf8");
        var tok = abnfTokenizer.tokenize(abnf);
        var par = abnfParser.parse(tok);
        var inter = new abnfInterpreter.Interpreter(par);
        return inter;
    }
});

//# sourceMappingURL=../../maps/spec/odata_parser_general_spec.js.map
