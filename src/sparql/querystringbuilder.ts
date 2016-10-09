import gpatterns = require("./graphpatterns");

export interface ISelectQueryStringBuilder {
  fromGraphPatternAndFilterExpression(prefixes: ReadonlyArray<IPrefix>, graphPattern: gpatterns.TreeGraphPattern,
                                      filter?: IFilterExpression): string;
}

export interface IInsertQueryStringBuilder {
  insertAsSparql(prefixes: ReadonlyArray<IPrefix>, uri: string, rdfType: ISparqlLiteral,
                 properties: PropertyDescription[]): string;
  updateAsSparql(prefixes: ReadonlyArray<IPrefix>, uri: string,
                 obsoleteProperties: PropertyDescription[], newProperties: PropertyDescription[],
                 pattern: PropertyDescription[]);
}

export interface PropertyDescription {
  rdfProperty: string;
  inverse: boolean;
  value: ISparqlLiteral;
}

export interface ISparqlLiteral {
  representAsSparql(): string;
}

export interface IPrefixBuilder {
  prefixesAsSparql(prefixes: ReadonlyArray<IPrefix>): string;
}

export interface IGraphPatternStringBuilder {
  buildGraphPatternString(pattern: gpatterns.TreeGraphPattern): string;
  buildGraphPatternStringAmendFilterExpression(pattern: gpatterns.TreeGraphPattern, filter?: IFilterExpression): string;
}

export interface ISelectSkeletonBuilder {
  buildSkeleton(prefixes: string, graphPattern: string): string;
}

export interface IFilterExpression {
  toSparqlFilterClause(): string;
}

export interface IPrefix {
  prefix: string;
  uri: string;
}

export class SelectQueryStringBuilder implements ISelectQueryStringBuilder {

  constructor(private prefixBuilder: IPrefixBuilder,
              private selectSkeletonBuilder: ISelectSkeletonBuilder,
              private patternBuilder: IGraphPatternStringBuilder) {}

  public fromGraphPatternAndFilterExpression(prefixes: ReadonlyArray<IPrefix>, graphPattern: gpatterns.TreeGraphPattern,
                                             filter?: IFilterExpression) {
    const prefixStr = this.prefixBuilder.prefixesAsSparql(prefixes);
    return this.selectSkeletonBuilder.buildSkeleton(
      prefixStr, this.patternBuilder.buildGraphPatternStringAmendFilterExpression(graphPattern, filter));
  }
}

export class InsertQueryStringBuilder implements IInsertQueryStringBuilder {

  constructor(private prefixBuilder: IPrefixBuilder, private graph: string) {}

  public insertAsSparql(prefixes: ReadonlyArray<IPrefix>, uri: string, rdfType: ISparqlLiteral,
                        properties: PropertyDescription[]): string {
    const propertiesWithType = [{ rdfProperty: "rdf:type", inverse: false, value: rdfType }].concat(properties);
    return this.updateAsSparql(prefixes, uri, [], propertiesWithType, []);
  }

  public updateAsSparql(prefixes: ReadonlyArray<IPrefix>, uri: string,
                        obsoleteProperties: PropertyDescription[], newProperties: PropertyDescription[],
                        pattern: PropertyDescription[]): string {
    let query = this.prefixBuilder.prefixesAsSparql(prefixes);

    if (obsoleteProperties.length !== 0) {
      appendToQuery(`DELETE`);
      if (pattern.length === 0) appendToQuery(`DATA`);
      appendToQuery(`{ GRAPH <${this.graph}> { ${this.triplesAsSparql(uri, obsoleteProperties) } } }`);
    }

    appendToQuery(`INSERT`);
    if (pattern.length === 0) appendToQuery(`DATA`);
    appendToQuery(`{ GRAPH <${this.graph}> { ${this.triplesAsSparql(uri, newProperties)} } }`);

    if (pattern.length !== 0) {
      appendToQuery(`WHERE`);
      appendToQuery(`{ GRAPH <${this.graph}> { ${this.triplesAsSparql(uri, pattern) } } }`);
    }

    return query;

    function appendToQuery(str: string) {
      if (query !== "") query += " ";
      query += str;
    }
  }

  private triplesAsSparql(uri: string,
                          properties: { rdfProperty: string, inverse: boolean, value: ISparqlLiteral }[]): string {
    return properties.map(sparqlFromProperty).join(" . ");

    function sparqlFromProperty(p: { rdfProperty: string, inverse: boolean, value: ISparqlLiteral }) {
      const base = `<${uri}>`;
      const property = p.rdfProperty;
      const value = p.value.representAsSparql();
      return p.inverse ? `${value} ${property} ${base}` : `${base} ${property} ${value}`;
    }
  }
}

export class PrefixBuilder implements IPrefixBuilder {
  public prefixesAsSparql(prefixes) {
    return prefixes.map(p => `PREFIX ${p.prefix}: <${p.uri}>`).join(" ");
  }
}

export class SelectSkeletonBuilder implements ISelectSkeletonBuilder {
  public buildSkeleton(prefixes: string, graphPattern: string): string {
    if (prefixes && prefixes.length > 0) prefixes += " ";
    return `${prefixes}SELECT * WHERE ${graphPattern}`;
  }
}

export class GraphPatternStringBuilder implements IGraphPatternStringBuilder {
  public buildGraphPatternString(pattern: gpatterns.TreeGraphPattern): string {
    return "{ " + this.buildPatternContent(pattern) + " }";
  }

  public buildGraphPatternStringAmendFilterExpression(pattern: gpatterns.TreeGraphPattern, filter?: IFilterExpression) {
    let patternStr = this.buildPatternContent(pattern);
    let filterStr = filter
      ? ((patternStr && patternStr.length > 0 ? " . " : "") + `FILTER(${filter.toSparqlFilterClause()})`)
      : "";
    return `{ ${patternStr}${filterStr} }`;
  }

  private buildPatternContent(pattern: gpatterns.TreeGraphPattern): string {
    let triplesString = pattern.getDirectTriples().map(t => t.join(" ")).join(" . ");
    let subPatternsString = pattern.getBranchPatterns()
      .map(p => this.buildPatternContent(p))
      .filter(str => str !== "")
      .join(" . ");
    let optionalPatternsString = pattern.getOptionalPatterns()
      .map(p => "OPTIONAL " + this.buildGraphPatternString(p))
      .filter(str => str !== "")
      .join(" . ");
    let conjunctivePatternsString = pattern.getConjunctivePatterns()
      .map(p => this.buildGraphPatternString(p))
      .join(" . ");
    let unionsString = pattern.getUnionPatterns()
      .map(p => this.buildGraphPatternString(p))
      .join(" UNION ");

    let result = "";
    function append(str: string) {
      if (result !== "") result += " ";
      result += str;
    }
    function appendWithPeriod(str: string) {
      if (result !== "") append(".");
      append(str);
    }
    if (triplesString !== "") appendWithPeriod(triplesString);
    if (subPatternsString !== "") appendWithPeriod(subPatternsString);
    if (conjunctivePatternsString !== "") append(conjunctivePatternsString);
    if (unionsString !== "") append(unionsString);
    if (optionalPatternsString !== "") appendWithPeriod(optionalPatternsString);

    return result;
  }
}
export class SparqlString implements ISparqlLiteral {
  constructor(private value: string) {}

  public representAsSparql() {
    return "'" + this.escapedValue() + "'";
  }

  public toString(): string {
    return `[SparqlString ${JSON.stringify(this.value)}]`;
  }

  private escapedValue() {
    const escape = [
      { from: /\\/g, to: "\\\\" },
      { from: /'/g, to: "\\'"},
      { from: /"/g, to: '\\"'},
      { from: /\f/g, to: "\\f"},
      { from: /[\b]/g, to: "\\b"},
      { from: /\r/g, to: "\\r"},
      { from: /\n/g, to: "\\n"},
      { from: /\t/g, to: "\\t"}];

    return escape.reduce((prev, rule) => prev.replace(rule.from, rule.to), this.value);
  }
}

export class SparqlNumber implements ISparqlLiteral {
  constructor(private value: string) {}

  public representAsSparql() {
    return "'" + parseFloat(this.value) + "'";
  }

  public toString(): string {
    return `[SparqlNumber ${JSON.stringify(this.value)}]`;
  }
}

export class SparqlUri implements ISparqlLiteral {
  constructor(private uri: string) {}

  public representAsSparql() {
    return "<" + this.verifiedUri() + ">";
  }

  private verifiedUri() {
    if (this.uri.indexOf(">") !== -1 || this.uri.indexOf("<") !== -1) throw new Error("invalid uri");
    else return this.uri;
  }
}

export class SparqlNamespacedUri implements ISparqlLiteral {
  constructor(private uri: string) {}

  public representAsSparql() {
    return this.verifiedUri();
  }

  private verifiedUri() {
    if (this.uri.indexOf(":") === -1)  throw new Error("invalid namespaced uri");
    else return this.uri;
  }
}

export class SparqlVariable implements ISparqlLiteral {
  constructor(private name: string & VariableNameOnly) {}

  public representAsSparql() {
    return `?${this.name}`;
  }

  public getNameOnly() {
    return this.name;
  }
}

/** "?var" instead of "var" */
export enum VariableWithSyntax {}

/** "var" instead of "?var" */
export enum VariableNameOnly {}
