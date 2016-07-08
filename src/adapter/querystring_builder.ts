import gpatterns = require("./sparql_graphpatterns");

export class QueryStringBuilder {
  private prefixes: { [id: string]: string } = { };

  public insertPrefix(prefix: string, uri: string) {
    this.prefixes[prefix] = uri;
  }

  public buildGraphPatternContentString(graphPattern: gpatterns.TreeGraphPattern): string {
    let triples = graphPattern.getDirectTriples().map(t => t.join(" ")).join(" . ");
    let subPatterns = graphPattern.getBranchPatterns()
      .map(p => this.buildGraphPatternContentString(p))
      .filter(str => str !== "")
      .join(" . ");
    let unions = graphPattern.getUnionPatterns()
      .map(p => this.buildGraphPatternString(p))
      .join(" UNION ");
    let parts = [];
    if (triples !== "") parts.push(triples);
    if (subPatterns !== "") parts.push(subPatterns);
    if (unions !== "") parts.push(unions);

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
