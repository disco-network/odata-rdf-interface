"use strict";
var abnfTokenizer = require("abnfjs/tokenizer");
var abnfParser = require("abnfjs/parser");
var abnfInterpreter = require("abnfjs/interpreter");
var ast2query = require("../odata/ast2query");
var schema = require("../odata/schema");
var sparqlQueries = require("../adapter/queries_sparql");
var fs = require("fs");
var QueryEngine = (function () {
    function QueryEngine() {
        this.schm = new schema.Schema();
        var abnf = fs.readFileSync("./src/odata/odata4-mod.abnf", "utf8");
        var tokens = new abnfTokenizer.tokenize(abnf);
        var grammar = new abnfParser.parse(tokens);
        this.interpreter = new abnfInterpreter.Interpreter(grammar);
    }
    QueryEngine.prototype.setSparqlProvider = function (value) {
        this.sparqlProvider = value;
    };
    QueryEngine.prototype.query = function (queryString, cb) {
        var url = queryString.substr(1);
        var ast = this.interpreter.getCompleteMatch(this.interpreter.getPattern("odataRelativeUri"), url);
        var queryModel = ast2query.getQueryModelFromEvaluatedAst(ast.evaluate(), this.schm.raw);
        var query = (new sparqlQueries.QueryFactory(queryModel, this.schm)).create();
        query.run(this.sparqlProvider, cb);
    };
    return QueryEngine;
}());
exports.QueryEngine = QueryEngine;

//# sourceMappingURL=../../maps/src/adapter/query_engine.js.map
