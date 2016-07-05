"use strict";
var QueryStringBuilder = (function () {
    function QueryStringBuilder() {
        this.prefixes = {};
    }
    QueryStringBuilder.prototype.insertPrefix = function (prefix, uri) {
        this.prefixes[prefix] = uri;
    };
    QueryStringBuilder.prototype.buildGraphPatternString = function (graphPattern) {
        var _this = this;
        var triples = graphPattern.getTriples().map(function (t) { return t.join(" "); });
        var unions = graphPattern.getUnionPatterns()
            .map(function (p) { return _this.buildGraphPatternString(p); })
            .join(" UNION ");
        var parts = (unions !== "") ? triples.concat(unions) : triples;
        return "{ " + parts.join(" . ") + " }";
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
