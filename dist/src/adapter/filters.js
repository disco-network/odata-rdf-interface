"use strict";
var FilterExpressionFactory = (function () {
    function FilterExpressionFactory() {
        this.registeredFilterExpressions = [];
        this.creationArgs = {
            factory: this,
            entityType: undefined,
            mapping: undefined,
        };
    }
    FilterExpressionFactory.prototype.fromRaw = function (raw) {
        if (this.validateCreationArgs()) {
            for (var i = 0; i < this.registeredFilterExpressions.length; ++i) {
                var SelectedFilterExpression = this.registeredFilterExpressions[i];
                if (SelectedFilterExpression.doesApplyToRaw(raw))
                    return SelectedFilterExpression.create(raw, this.creationArgs);
            }
            throw new Error("filter expression is not supported: " + JSON.stringify(raw));
        }
        else {
            throw new Error("Can't create filter expressions with incomplete creation args.");
        }
    };
    FilterExpressionFactory.prototype.setSparqlVariableMapping = function (mapping) {
        this.creationArgs.mapping = mapping;
        return this;
    };
    FilterExpressionFactory.prototype.setEntityType = function (entityType) {
        this.creationArgs.entityType = entityType;
        return this;
    };
    FilterExpressionFactory.prototype.registerDefaultFilterExpressions = function () {
        this.registerFilterExpressions([
            exports.StringLiteralExpression, exports.NumberLiteralExpression,
            ParenthesesExpressionFactory,
            exports.AndExpression, exports.OrExpression,
            exports.EqExpression,
            PropertyExpression,
        ]);
        return this;
    };
    FilterExpressionFactory.prototype.registerFilterExpressions = function (types) {
        for (var i = 0; i < types.length; ++i) {
            this.registerFilterExpression(types[i]);
        }
        return this;
    };
    FilterExpressionFactory.prototype.registerFilterExpression = function (Type) {
        if (this.registeredFilterExpressions.indexOf(Type) === -1)
            this.registeredFilterExpressions.push(Type);
        return this;
    };
    FilterExpressionFactory.prototype.validateCreationArgs = function () {
        return this.creationArgs.entityType !== undefined &&
            this.creationArgs.mapping !== undefined &&
            this.creationArgs.factory !== undefined;
    };
    return FilterExpressionFactory;
}());
exports.FilterExpressionFactory = FilterExpressionFactory;
exports.StringLiteralExpression = literalExpression({
    typeName: "string",
    parse: function (raw) { return raw.value; },
    toSparql: function (value) { return "'" + value + "'"; },
});
exports.NumberLiteralExpression = literalExpression({
    typeName: "decimalValue",
    parse: function (raw) {
        var ret = parseInt(raw.value, 10);
        if (isNaN(ret))
            throw new Error("error parsing number literal " + raw.value);
        else
            return ret;
    },
    toSparql: function (value) { return "'" + value + "'"; },
});
exports.OrExpression = binaryOperator({ opName: "or", sparql: "||" });
exports.AndExpression = binaryOperator({ opName: "and", sparql: "&&" });
exports.EqExpression = binaryOperator({ opName: "eq", sparql: "=" });
var PropertyExpression = (function () {
    function PropertyExpression() {
    }
    PropertyExpression.doesApplyToRaw = function (raw) {
        return raw.type === "member-expression";
    };
    PropertyExpression.create = function (raw, args) {
        var ret = new PropertyExpression();
        ret.properties = raw.path;
        ret.operation = this.operationFromRaw(raw.operation);
        ret.mapping = args.mapping;
        ret.entityType = args.entityType;
        return ret;
    };
    PropertyExpression.operationFromRaw = function (raw) {
        switch (raw) {
            case "property-value":
                return PropertyExpressionOperation.PropertyValue;
            case "any":
                return PropertyExpressionOperation.Any;
            default:
                throw new Error("invalid operation string: " + raw);
        }
    };
    PropertyExpression.prototype.getSubExpressions = function () {
        return [];
    };
    PropertyExpression.prototype.getPropertyTree = function () {
        var tree = {};
        var branch = tree;
        for (var i = 0; i < this.properties.length; ++i) {
            branch = branch[this.properties[i]] = branch[this.properties[i]] || {};
        }
        return tree;
    };
    PropertyExpression.prototype.toSparql = function () {
        switch (this.operation) {
            case PropertyExpressionOperation.PropertyValue:
                return this.propertyValueExpressionToSparql();
            case PropertyExpressionOperation.Any:
                return this.anyExpressionToSparql();
            default:
                throw new Error("Huh? this.operation has an invalid value");
        }
    };
    PropertyExpression.prototype.propertyValueExpressionToSparql = function () {
        var currentMapping = this.mapping;
        for (var i = 0; i < (this.properties.length - 1); ++i) {
            currentMapping = currentMapping.getComplexProperty(this.properties[i]);
        }
        return currentMapping.getElementaryPropertyVariable(this.properties[this.properties.length - 1]);
    };
    PropertyExpression.prototype.anyExpressionToSparql = function () {
        /* @construction
        let vargen = new mappings.SparqlVariableGenerator();
        let mapping = new mappings.StructuredSparqlVariableMapping(vargen.next(), vargen);
        let filterPattern = new gpatterns.FilterGraphPattern(
          this.entityType, "propertyTree", mapping
        );
        return "EXISTS { ?root disco:prop ?child . FilterPattern[root=?child] . FILTER() }";
        */
        return "nope";
    };
    return PropertyExpression;
}());
exports.PropertyExpression = PropertyExpression;
(function (PropertyExpressionOperation) {
    PropertyExpressionOperation[PropertyExpressionOperation["PropertyValue"] = 0] = "PropertyValue";
    PropertyExpressionOperation[PropertyExpressionOperation["Any"] = 1] = "Any";
})(exports.PropertyExpressionOperation || (exports.PropertyExpressionOperation = {}));
var PropertyExpressionOperation = exports.PropertyExpressionOperation;
var ParenthesesExpressionFactory = (function () {
    function ParenthesesExpressionFactory() {
    }
    ParenthesesExpressionFactory.doesApplyToRaw = function (raw) {
        return raw.type === "parentheses-expression";
    };
    ParenthesesExpressionFactory.create = function (raw, args) {
        // We don't have to return a ParenthesesExpression, let's choose the direct way
        return args.factory.fromRaw(raw.inner);
    };
    return ParenthesesExpressionFactory;
}());
exports.ParenthesesExpressionFactory = ParenthesesExpressionFactory;
function literalExpression(config) {
    var GeneratedClass = (function () {
        function class_1() {
        }
        class_1.doesApplyToRaw = function (raw) {
            return raw.type === config.typeName;
        };
        class_1.create = function (raw, args) {
            var ret = new GeneratedClass();
            ret.value = config.parse(raw);
            return ret;
        };
        class_1.prototype.getSubExpressions = function () {
            return [];
        };
        class_1.prototype.getPropertyTree = function () {
            return {};
        };
        class_1.prototype.toSparql = function () {
            return config.toSparql(this.value);
        };
        return class_1;
    }());
    return GeneratedClass;
}
function binaryOperator(config) {
    var GeneratedClass = (function () {
        function class_2() {
        }
        class_2.doesApplyToRaw = function (raw) {
            return raw.type === "operator" && raw.op === config.opName;
        };
        class_2.create = function (raw, args) {
            var ret = new GeneratedClass();
            ret.lhs = args.factory.fromRaw(raw.lhs);
            ret.rhs = args.factory.fromRaw(raw.rhs);
            return ret;
        };
        class_2.prototype.getSubExpressions = function () {
            return [this.lhs, this.rhs];
        };
        class_2.prototype.getPropertyTree = function () {
            return FilterExpressionHelper.getPropertyTree(this.getSubExpressions());
        };
        class_2.prototype.toSparql = function () {
            return "(" + this.lhs.toSparql() + " " + config.sparql + " " + this.rhs.toSparql() + ")";
        };
        return class_2;
    }());
    return GeneratedClass;
}
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
