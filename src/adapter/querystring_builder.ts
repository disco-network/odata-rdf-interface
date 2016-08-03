import gpatterns = require("../sparql/graphpatterns");
import filters = require("./filters");

export interface IQueryStringBuilder {
  insertPrefix(prefix: string, uri: string);
  fromGraphPattern(graphPattern: gpatterns.TreeGraphPattern,
                   options?: IQueryStringBuilderOptions): string;
  buildGraphPatternStringWithOptions(graphPattern, options?: IQueryStringBuilderOptions): string;
  buildFilterPatternAmendmentString(options?: IQueryStringBuilderOptions): string;
  buildGraphPatternString(graphPattern: gpatterns.TreeGraphPattern): string;
  buildGraphPatternContentString(graphPattern: gpatterns.TreeGraphPattern): string;
}

export class QueryStringBuilder {
  private prefixes: { [id: string]: string } = { };

  public insertPrefix(prefix: string, uri: string) {
    this.prefixes[prefix] = uri;
  }

  public fromGraphPattern(graphPattern: gpatterns.TreeGraphPattern,
                          options?: IQueryStringBuilderOptions): string {
    return this.buildPrefixString() +
      " SELECT * WHERE " + this.buildGraphPatternStringWithOptions(graphPattern, options);
  }

  public buildGraphPatternStringWithOptions(graphPattern, options?: IQueryStringBuilderOptions): string {
    let ret = "{ " + this.buildGraphPatternString(graphPattern);
    let filter = this.buildFilterPatternAmendmentString(options);
    ret += filter;
    ret += " }";
    return ret;
  }

  public buildGraphPatternString(graphPattern: gpatterns.TreeGraphPattern): string {
    return "{ " + this.buildGraphPatternContentString(graphPattern) + " }";
  }

  public buildGraphPatternContentString(graphPattern: gpatterns.TreeGraphPattern): string {
    let triplesString = graphPattern.getDirectTriples().map(t => t.join(" ")).join(" . ");
    let subPatternsString = graphPattern.getBranchPatterns()
      .map(p => this.buildGraphPatternContentString(p))
      .filter(str => str !== "")
      .join(" . ");
    let optionalPatternsString = graphPattern.getOptionalPatterns()
      .map(p => "OPTIONAL " + this.buildGraphPatternString(p))
      .filter(str => str !== "")
      .join(" . ");
    let conjunctivePatternsString = graphPattern.getConjunctivePatterns()
      .map(p => this.buildGraphPatternString(p))
      /* we need to filter out empty patterns because of an issue in rdfstore-js */
      .filter(s => s !== "{  }")
      .join(" . ");
    let unionsString = graphPattern.getUnionPatterns()
      .map(p => this.buildGraphPatternString(p))
      .filter(s => s !== "{  }")
      .join(" UNION ");
    let parts = [];

    if (triplesString !== "") parts.push(triplesString);
    if (subPatternsString !== "") parts.push(subPatternsString);
    if (optionalPatternsString !== "") parts.push(optionalPatternsString);
    if (conjunctivePatternsString !== "") parts.push(conjunctivePatternsString);
    if (unionsString !== "") parts.push(unionsString);

    return parts.join(" . ");
  }

  private buildFilterPatternAmendmentString(options?: IQueryStringBuilderOptions) {
    let ret = "";
    if (options && options.filterExpression) {
      if (options && options.filterPattern) {
        let filterPatternString = this.buildGraphPatternString(options.filterPattern);
        /* we need to filter out empty patterns because of an issue in rdfstore-js */
        if (filterPatternString !== "{  }")
          ret += " . " + filterPatternString;
      }
      ret += " . FILTER(" + options.filterExpression.toSparql() + ")";
    }
    return ret;
  }

  private buildPrefixString() {
    let parts: string[] = [ ];
    for (let prefix of Object.keys(this.prefixes)) {
      parts.push("PREFIX " + prefix + ": <" + this.prefixes[prefix] + ">");
    }
    return parts.join(" ");
  }
}

export interface IQueryStringBuilderOptions {
  filterExpression?: filters.IFilterExpression;
  filterPattern?: gpatterns.TreeGraphPattern;
}
