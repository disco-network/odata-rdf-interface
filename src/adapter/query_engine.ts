import abnfTokenizer = require("abnfjs/tokenizer");
import abnfParser = require("abnfjs/parser");
import abnfInterpreter = require("abnfjs/interpreter");

import sparqlProvider = require("../sparql/sparql_provider_base");
import ast2query = require("../odata/ast2query");
import schema = require("../odata/schema");
import queries = require("../adapter/queries");
import result = require("../result");

import fs = require("fs");

export class QueryEngine {
  private interpreter: abnfInterpreter.Interpreter;
  private sparqlProvider: sparqlProvider.SparqlProviderBase;
  private schm = new schema.Schema();

  constructor() {
    let abnf = fs.readFileSync("./src/odata/odata4-mod.abnf", "utf8");
    let tokens = new abnfTokenizer.tokenize(abnf);
    let grammar = new abnfParser.parse(tokens);
    this.interpreter = new abnfInterpreter.Interpreter(grammar);
  }

  public setSparqlProvider(value: sparqlProvider.SparqlProviderBase) {
    this.sparqlProvider = value;
  }

  public query(queryString: string, cb: (result: result.AnyResult) => void) {
    let url = queryString.substr(1);

    let ast = this.interpreter.getCompleteMatch(this.interpreter.getPattern("odataRelativeUri"), url);
    let queryModel = ast2query.getQueryModelFromEvaluatedAst(ast.evaluate(), this.schm);
    let query = (new queries.QueryFactory(queryModel)).create();
    query.run(this.sparqlProvider, cb);
  }
}
