import gpatterns = require("./graphpatterns");

export interface ISelectQueryStringBuilder {
  fromGraphPatternAndFilterExpression(prefixes: IPrefix[], graphPattern: gpatterns.TreeGraphPattern,
                                      filter?: IFilterExpression): string;
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

  constructor(private selectSkeletonBuilder: ISelectSkeletonBuilder,
              private patternBuilder: IGraphPatternStringBuilder) {}

  public fromGraphPatternAndFilterExpression(prefixes: IPrefix[], graphPattern: gpatterns.TreeGraphPattern,
                                             filter?: IFilterExpression) {
    let prefixStr = prefixes.map(p => `PREFIX ${p.prefix}: <${p.uri}>`).join(" ");
    return this.selectSkeletonBuilder.buildSkeleton(
      prefixStr, this.patternBuilder.buildGraphPatternStringAmendFilterExpression(graphPattern, filter));
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
      /* we need to filter out empty patterns because of an issue in rdfstore-js */
      .filter(s => s !== "{  }")
      .join(" . ");
    let unionsString = pattern.getUnionPatterns()
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
}
