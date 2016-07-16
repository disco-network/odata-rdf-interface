"use strict";
var QueryStringBuilder = (function () {
    function QueryStringBuilder() {
        this.prefixes = {};
    }
    QueryStringBuilder.prototype.insertPrefix = function (prefix, uri) {
        this.prefixes[prefix] = uri;
    };
    QueryStringBuilder.prototype.fromGraphPattern = function (graphPattern, options) {
        return this.buildPrefixString() +
            " SELECT * WHERE " + this.buildGraphPatternStringWithOptions(graphPattern, options);
    };
    QueryStringBuilder.prototype.buildGraphPatternStringWithOptions = function (graphPattern, options) {
        var ret = "{ " + this.buildGraphPatternString(graphPattern);
        var filter = this.buildFilterPatternAmendmentString(options);
        ret += filter;
        ret += " }";
        return ret;
    };
    QueryStringBuilder.prototype.buildFilterPatternAmendmentString = function (options) {
        var ret = "";
        if (options && options.filterExpression) {
            if (options && options.filterPattern) {
                ret += " . " + this.buildGraphPatternString(options.filterPattern);
            }
            ret += " . FILTER(" + options.filterExpression.toSparql() + ")";
        }
        return ret;
    };
    QueryStringBuilder.prototype.buildGraphPatternString = function (graphPattern) {
        return "{ " + this.buildGraphPatternContentString(graphPattern) + " }";
    };
    QueryStringBuilder.prototype.buildGraphPatternContentString = function (graphPattern) {
        var _this = this;
        var triplesString = graphPattern.getDirectTriples().map(function (t) { return t.join(" "); }).join(" . ");
        var subPatternsString = graphPattern.getBranchPatterns()
            .map(function (p) { return _this.buildGraphPatternContentString(p); })
            .filter(function (str) { return str !== ""; })
            .join(" . ");
        var optionalPatternsString = graphPattern.getOptionalPatterns()
            .map(function (p) { return "OPTIONAL " + _this.buildGraphPatternString(p); })
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
        if (optionalPatternsString !== "")
            parts.push(optionalPatternsString);
        if (unionsString !== "")
            parts.push(unionsString);
        return parts.join(" . ");
    };
    QueryStringBuilder.prototype.buildPrefixString = function () {
        var parts = [];
        for (var prefix in this.prefixes) {
            parts.push("PREFIX " + prefix + ": <" + this.prefixes[prefix] + ">");
        }
        return parts.join(" ");
    };
    return QueryStringBuilder;
}());
exports.QueryStringBuilder = QueryStringBuilder;

//# sourceMappingURL=../../../maps/src/adapter/querystring_builder.js.map
