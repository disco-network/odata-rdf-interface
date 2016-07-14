import gpatterns = require("./sparql_graphpatterns");
import filters = require("./filters");

export class QueryStringBuilder {
  private prefixes: { [id: string]: string } = { };

  public insertPrefix(prefix: string, uri: string) {
    this.prefixes[prefix] = uri;
  }

  public fromGraphPattern(graphPattern: gpatterns.TreeGraphPattern,
                          options?: QueryStringBuilderOptions): string {
    return this.buildPrefixString() +
      " SELECT * WHERE " + this.buildGraphPatternStringWithOptions(graphPattern, options);
  }

  public buildGraphPatternStringWithOptions(graphPattern, options?: QueryStringBuilderOptions): string {
    let ret = "{ " + this.buildGraphPatternString(graphPattern);
    if (options && options.filterExpression) {
      if (options && options.filterPattern) {
        ret += " . " + this.buildGraphPatternString(options.filterPattern);
      }
      ret += " . FILTER(" + options.filterExpression.toSparql() + ")";
    }
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
    let unionsString = graphPattern.getUnionPatterns()
      .map(p => this.buildGraphPatternString(p))
      .join(" UNION ");
    let parts = [];

    if (triplesString !== "") parts.push(triplesString);
    if (subPatternsString !== "") parts.push(subPatternsString);
    if (optionalPatternsString !== "") parts.push(optionalPatternsString);
    if (unionsString !== "") parts.push(unionsString);

    return parts.join(" . ");
  }

  public buildPrefixString() {
    let parts: string[] = [ ];
    for (let prefix in this.prefixes) {
      parts.push("PREFIX " + prefix + ": <" + this.prefixes[prefix] + ">");
    }
    return parts.join(" ");
  }
}

export interface QueryStringBuilderOptions {
  filterExpression?: filters.FilterExpression;
  filterPattern?: gpatterns.FilterGraphPattern;
}
