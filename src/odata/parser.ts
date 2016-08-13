import abnfTokenizer = require("abnfjs/tokenizer");
import abnfParser = require("abnfjs/parser");
import abnfInterpreter = require("abnfjs/interpreter");
import fs = require("fs");
import { IHttpRequest } from "./http";

export interface IPostRequestParser {
  parse(request: IHttpRequest): IParsedPostRequest;
}

export interface IParsedPostRequest {
  entitySetName: string;
  entity: any;
}

export interface IGetRequestParser {
  parse(request: IHttpRequest): IParsedGetRequest;
}

export interface IParsedGetRequest {
  entitySetName: string;
  expandTree: any;
  filterTree: any;
}

export interface IODataParser {
  parse(query: string): any;
}

export class PostRequestParser implements IPostRequestParser {

  private odataParser = new ODataParser();

  public parse(request: IHttpRequest): IParsedPostRequest {
    let ast = this.odataParser.parse(request.relativeUrl);
    return {
      entitySetName: ast.resourcePath.entitySetName,
      entity: JSON.stringify(request.body),
    };
  }
}

export class ODataParser implements IODataParser {

  private interpreter: abnfInterpreter.Interpreter;

  constructor() {
    let abnf = fs.readFileSync("./src/odata/odata4-mod.abnf", "utf8");
    let tokens = new abnfTokenizer.tokenize(abnf);
    let grammar = new abnfParser.parse(tokens);
    this.interpreter = new abnfInterpreter.Interpreter(grammar);
  }

  public parse(query: string): any {
    query = query.substr(1); // remove "/"
    return this.interpreter
      .getCompleteMatch(this.interpreter.getPattern("odataRelativeUri"), query)
      .evaluate();
  }
}
