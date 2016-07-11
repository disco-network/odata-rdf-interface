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
        var triplesString = graphPattern.getDirectTriples().map(function (t) { return t.join(" "); }).join(" . ");
        var subPatternsString = graphPattern.getBranchPatterns()
            .map(function (p) { return _this.buildGraphPatternContentString(p); })
            .filter(function (str) { return str !== ""; })
            .join(" . ");
        var unionsString = graphPattern.getUnionPatterns()
            .map(function (p) { return _this.buildGraphPatternString(p); })
            .join(" UNION ");
        var parts = [];
        if (triplesString !== "")
            parts.push(triplesString);
        if (subPatternsString !== "")
            parts.push(subPatternsString);
        if (unionsString !== "")
            parts.push(unionsString);
        return parts.join(" . ");
    };
    QueryStringBuilder.prototype.buildGraphPatternString = function (graphPattern) {
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

//# sourceMappingURL=../../../maps/src/adapter/querystring_builder.js.map
