import gpatterns = require("./sparql_graphpatterns");

export class QueryStringBuilder {
  private prefixes: { [id: string]: string } = { };

  public insertPrefix(prefix: string, uri: string) {
    this.prefixes[prefix] = uri;
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

  public buildGraphPatternString(graphPattern: gpatterns.TreeGraphPattern): string {
    return "{ " + this.buildGraphPatternContentString(graphPattern) + " }";
  }
  public buildPrefixString() {
    let parts: string[] = [ ];
    for (let prefix in this.prefixes) {
      parts.push("PREFIX " + prefix + ": <" + this.prefixes[prefix] + ">");
    }
    return parts.join(" ");
  }
  public fromGraphPattern(graphPattern: gpatterns.TreeGraphPattern): string {
    return this.buildPrefixString() +
      " SELECT * WHERE " + this.buildGraphPatternString(graphPattern);
  }
}