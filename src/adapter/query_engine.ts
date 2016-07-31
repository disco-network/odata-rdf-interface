import abnfTokenizer = require("abnfjs/tokenizer");
import abnfParser = require("abnfjs/parser");
import abnfInterpreter = require("abnfjs/interpreter");

import sparqlProvider = require("../sparql/sparql_provider_base");
import odataParser = require("../odata/odata_parser_base");
import entityReader = require("../odata/entity_reader_base");
import postQueries = require("../adapter/postquery");
import ast2query = require("../odata/ast2query");
import schema = require("../odata/schema");
import queries = require("../adapter/queries");
import result = require("../result");

import fs = require("fs");

/* The interface should conform encapsulation, hence the implementation
   is responsible for dependency injection - see below. */
export interface IQueryEngine {
  query(queryString: string, cb: (result: result.AnyResult) => void);
  queryPOST(queryString: string, cb: (result: result.AnyResult) => void);
}

export class QueryEngine {
  private interpreter: abnfInterpreter.Interpreter;
  private sparqlProvider: sparqlProvider.SparqlProviderBase;
  private odataParser: odataParser.ODataParserBase;
  private entityReader: entityReader.EntityReaderBase;
  private postQueryStringBuilder: postQueries.QueryStringBuilder;
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

  public setODataParser(value: odataParser.ODataParserBase) {
    this.odataParser = value;
  }

  public setEntityReader(value: entityReader.EntityReaderBase) {
    this.entityReader = value;
  }

  public setPostQueryStringBuilder(value: postQueries.QueryStringBuilder) {
    this.postQueryStringBuilder = value;
  }

  public query(queryString: string, cb: (result: result.AnyResult) => void) {
    let url = queryString.substr(1);

    let ast = this.interpreter.getCompleteMatch(this.interpreter.getPattern("odataRelativeUri"), url);
    let odataModel = ast2query.getQueryModelFromEvaluatedAst(ast.evaluate(), this.schm);
    let modelAdapter = new queries.QueryAdapterModelImpl(odataModel);
    let query = (new queries.QueryFactory(modelAdapter)).create();
    query.run(this.sparqlProvider, cb);
  }

  public queryPOST(queryString: string, cb: (result: result.AnyResult) => void) {
    //
  }
}
