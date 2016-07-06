"use strict";
var QueryStringBuilder = (function () {
    function QueryStringBuilder() {
        this.prefixes = {};
    }
    QueryStringBuilder.prototype.insertPrefix = function (prefix, uri) {
        this.prefixes[prefix] = uri;
    };
    QueryStringBuilder.prototype.buildGraphPatternContentString = function (graphPattern) {
        var _this = this;
        var triples = graphPattern.getDirectTriples().map(function (t) { return t.join(" "); }).join(" . ");
        var subPatterns = graphPattern.getBranchPatterns()
            .map(function (p) { return _this.buildGraphPatternContentString(p); })
            .filter(function (str) { return str !== ""; })
            .join(" . ");
        var unions = graphPattern.getUnionPatterns()
            .map(function (p) { return _this.buildGraphPatternString(p); })
            .join(" UNION ");
        var parts = [];
        if (triples !== "")
            parts.push(triples);
        if (subPatterns !== "")
            parts.push(subPatterns);
        if (unions !== "")
            parts.push(unions);
        return parts.join(" . ");
    };
    QueryStringBuilder.prototype.buildGraphPatternString = function (graphPattern) {
        /*let triples = graphPattern.getTriples().map(t => t.join(" "));
        let unions = graphPattern.getUnionPatterns()
          .map(p => this.buildGraphPatternString(p))
          .join(" UNION ");
        let parts = ( unions !== "" ) ? triples.concat(unions) : triples;*/
        return "{ " + this.buildGraphPatternContentString(graphPattern) + " }";
    };
    QueryStringBuilder.prototype.buildPrefixString = function () {
        var parts = [];
        for (var prefix in this.prefixes) {
            parts.push("PREFIX " + prefix + ": <" + this.prefixes[prefix] + ">");
        }
        return parts.join(" ");
    };
    QueryStringBuilder.prototype.fromGraphPattern = function (graphPattern) {
        return this.buildPrefixString() +
            " SELECT * WHERE " + this.buildGraphPatternString(graphPattern);
    };
    return QueryStringBuilder;
}());
exports.QueryStringBuilder = QueryStringBuilder;

//# sourceMappingURL=../../maps/src/adapter/querystring_builder.js.map
