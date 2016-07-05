import gpatterns = require("./sparql_graphpatterns");

export class QueryStringBuilder {
  private prefixes: { [id: string]: string } = { };

  public insertPrefix(prefix: string, uri: string) {
    this.prefixes[prefix] = uri;
  }

  public buildGraphPatternString(graphPattern: gpatterns.TreeGraphPattern): string {
    let triples = graphPattern.getTriples().map(t => t.join(" "));
    let unions = graphPattern.getUnionPatterns()
      .map(p => this.buildGraphPatternString(p))
      .join(" UNION ");
    let parts = ( unions !== "" ) ? triples.concat(unions) : triples;
    return "{ " + parts.join(" . ") + " }";
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
