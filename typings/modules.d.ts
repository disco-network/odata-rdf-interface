declare module "connect" {
    let x: any;
    export = x;
}

declare module "fs" {
    let x: any;
    export = x;
}

declare module "abnfjs/tokenizer" {
    let x: any;
    export = x;
}

declare module "abnfjs/parser" {
    let x: any;
    export = x;
}

declare module "abnfjs/interpreter" {
    export class Interpreter {
        constructor(grammar: any);
        public getPattern(name: string): Parser;
        public getCompleteMatch(parser: Parser, str: string): Result;
    }

    export interface Parser {
        parseNext(str: string, interator: any): any;
    }

    export interface Result {
        evaluate(): any;
    }
}

declare module "rdfstore" {
    let x: any;
    export = x;
}