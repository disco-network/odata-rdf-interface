"use strict";
var FilterExpressionFactory = (function () {
    function FilterExpressionFactory() {
        this.registeredFilterExpressions = [];
    }
    FilterExpressionFactory.prototype.fromRaw = function (raw) {
        for (var i = 0; i < this.registeredFilterExpressions.length; ++i) {
            var SelectedFilterExpression = this.registeredFilterExpressions[i];
            if (SelectedFilterExpression.doesApplyToRaw(raw))
                return SelectedFilterExpression.create(raw, this.mapping, this);
        }
        throw new Error("filter expression is not supported: " + JSON.stringify(raw));
    };
    FilterExpressionFactory.prototype.setSparqlVariableMapping = function (mapping) {
        this.mapping = mapping;
        return this;
    };
    FilterExpressionFactory.prototype.registerDefaultFilterExpressions = function () {
        this.registerFilterExpressions([
            StringLiteralExpression, NumberLiteralExpression,
            ParenthesesExpressionFactory,
            EqExpression,
            PropertyExpression,
        ]);
        return this;
    };
    FilterExpressionFactory.prototype.registerFilterExpressions = function (types) {
        for (var i = 0; i < types.length; ++i) {
            this.registerFilterExpression(types[i]);
        }
    };
    FilterExpressionFactory.prototype.registerFilterExpression = function (Type) {
        if (this.registeredFilterExpressions.indexOf(Type) === -1)
            this.registeredFilterExpressions.push(Type);
    };
    return FilterExpressionFactory;
}());
exports.FilterExpressionFactory = FilterExpressionFactory;
var StringLiteralExpression = (function () {
    function StringLiteralExpression() {
    }
    StringLiteralExpression.doesApplyToRaw = function (raw) {
        return raw.type === "string";
    };
    StringLiteralExpression.create = function (raw, mapping, factory) {
        var ret = new StringLiteralExpression();
        ret.value = raw.value;
        return ret;
    };
    StringLiteralExpression.prototype.getSubExpressions = function () {
        return [];
    };
    StringLiteralExpression.prototype.getPropertyTree = function () {
        return {};
    };
    StringLiteralExpression.prototype.toSparql = function () {
        return "'" + this.value + "'";
    };
    return StringLiteralExpression;
}());
exports.StringLiteralExpression = StringLiteralExpression;
var NumberLiteralExpression = (function () {
    function NumberLiteralExpression() {
    }
    NumberLiteralExpression.doesApplyToRaw = function (raw) {
        return raw.type === "decimalValue";
    };
    NumberLiteralExpression.create = function (raw, mapping, factory) {
        var ret = new NumberLiteralExpression();
        ret.value = parseInt(raw.value, 10);
        if (isNaN(ret.value))
            throw new Error("error parsing number " + raw.value);
        return ret;
    };
    NumberLiteralExpression.prototype.getSubExpressions = function () {
        return [];
    };
    NumberLiteralExpression.prototype.getPropertyTree = function () {
        return {};
    };
    NumberLiteralExpression.prototype.toSparql = function () {
        return "'" + this.value.toString() + "'";
    };
    return NumberLiteralExpression;
}());
exports.NumberLiteralExpression = NumberLiteralExpression;
var EqExpression = (function () {
    function EqExpression() {
    }
    EqExpression.doesApplyToRaw = function (raw) {
        return raw.type === "operator" && raw.op === "eq";
    };
    EqExpression.create = function (raw, mapping, factory) {
        var ret = new EqExpression();
        ret.lhs = factory.fromRaw(raw.lhs);
        ret.rhs = factory.fromRaw(raw.rhs);
        return ret;
    };
    EqExpression.prototype.getSubExpressions = function () {
        return [this.lhs, this.rhs];
    };
    EqExpression.prototype.getPropertyTree = function () {
        return FilterExpressionHelper.getPropertyTree(this.getSubExpressions());
    };
    EqExpression.prototype.toSparql = function () {
        return "(" + this.lhs.toSparql() + " = " + this.rhs.toSparql() + ")";
    };
    return EqExpression;
}());
exports.EqExpression = EqExpression;
var PropertyExpression = (function () {
    function PropertyExpression() {
    }
    PropertyExpression.doesApplyToRaw = function (raw) {
        return raw.type === "member-expression";
    };
    PropertyExpression.create = function (raw, mapping, factory) {
        var ret = new PropertyExpression();
        ret.propertyName = raw.path.propertyName;
        ret.mapping = mapping;
        return ret;
    };
    PropertyExpression.prototype.getSubExpressions = function () {
        return [];
    };
    PropertyExpression.prototype.getPropertyTree = function () {
        var tree = {};
        tree[this.propertyName] = {};
        return tree;
    };
    PropertyExpression.prototype.toSparql = function () {
        return this.mapping.getElementaryPropertyVariable(this.propertyName);
    };
    return PropertyExpression;
}());
exports.PropertyExpression = PropertyExpression;
var ParenthesesExpressionFactory = (function () {
    function ParenthesesExpressionFactory() {
    }
    ParenthesesExpressionFactory.doesApplyToRaw = function (raw) {
        return raw.type === "parentheses-expression";
    };
    ParenthesesExpressionFactory.create = function (raw, mapping, factory) {
        // We don't have to return a ParenthesesExpression, let's choose the simpler way
        return factory.fromRaw(raw.inner);
    };
    return ParenthesesExpressionFactory;
}());
exports.ParenthesesExpressionFactory = ParenthesesExpressionFactory;
var PropertyTreeBuilder = (function () {
    function PropertyTreeBuilder() {
        this.tree = {};
    }
    PropertyTreeBuilder.prototype.merge = function (other) {
        this.mergeRecursive(this.tree, other);
    };
    PropertyTreeBuilder.prototype.mergeRecursive = function (baseBranch, mergeBranch) {
        var _this = this;
        Object.keys(mergeBranch).forEach(function (propertyName) {
            if (baseBranch[propertyName] === undefined) {
                baseBranch[propertyName] = {};
            }
            _this.mergeRecursive(baseBranch[propertyName], mergeBranch[propertyName]);
        });
    };
    return PropertyTreeBuilder;
}());
exports.PropertyTreeBuilder = PropertyTreeBuilder;
var FilterExpressionHelper = (function () {
    function FilterExpressionHelper() {
    }
    FilterExpressionHelper.getPropertyTree = function (subExpressions) {
        var propertyTrees = subExpressions.map(function (se) { return se.getPropertyTree(); });
        var returnTreeBuilder = new PropertyTreeBuilder();
        propertyTrees.forEach(function (tree) {
            returnTreeBuilder.merge(tree);
        });
        return returnTreeBuilder.tree;
    };
    return FilterExpressionHelper;
}());
exports.FilterExpressionHelper = FilterExpressionHelper;

//# sourceMappingURL=../../../maps/src/adapter/filters.js.map
