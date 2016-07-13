"use strict";
var filters = require("../src/adapter/filters");
describe("A filter factory", function () {
    it("should choose the right FilterExpression-implementing class", function () {
        var raw = {
            type: "operator",
            op: "eq",
            lhs: { type: "string", value: "1" },
            rhs: { type: "string", value: "2" },
        };
        var factory = new filters.FilterExpressionFactory();
        factory.registerDefaultFilterExpressions();
        var filter = factory.fromRaw(raw);
        expect(filter instanceof filters.EqExpression).toBe(true);
        expect(filter.lhs instanceof filters.StringLiteralExpression).toBe(true);
        expect(filter.rhs instanceof filters.StringLiteralExpression).toBe(true);
    });
});
describe("A StringLiteralExpression", function () {
    it("should render to a SPARQL string", function () {
        var expr = filters.StringLiteralExpression.create({ type: "string", value: "cat" }, null);
        expect(expr.toSparql()).toBe("'cat'");
    });
    xit("should escape special characters", function () { return undefined; });
});
describe("A EqExpression", function () {
    it("should render to a SPARQL string", function () {
        var factory = new filters.FilterExpressionFactory();
        factory.registerDefaultFilterExpressions();
        factory.registerFilterExpression(TestFilterExpression);
        var expr = factory.fromRaw({ type: "operator", op: "eq",
            lhs: { type: "test", value: "(lhs)" },
            rhs: { type: "test", value: "(rhs)" },
        });
        expect(expr.toSparql()).toBe("(lhs) = (rhs)");
    });
});
var TestFilterExpression = (function () {
    function TestFilterExpression(value) {
        this.value = value;
    }
    TestFilterExpression.doesApplyToRaw = function (raw) { return raw.type === "test"; };
    TestFilterExpression.create = function (raw, factory) { return new TestFilterExpression(raw.value); };
    TestFilterExpression.prototype.getSubExpressions = function () { return []; };
    TestFilterExpression.prototype.getPropertyTree = function () { return {}; };
    TestFilterExpression.prototype.toSparql = function () { return this.value.toString(); };
    return TestFilterExpression;
}());

//# sourceMappingURL=../../maps/spec/filters_spec.js.map
