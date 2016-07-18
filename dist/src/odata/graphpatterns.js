"use strict";
/**
 * Provides a SPARQL graph pattern whose triples are generated from a
 * property tree
 */
var TreeGraphPattern = (function () {
    function TreeGraphPattern(rootName) {
        var _this = this;
        this.valueLeaves = {};
        this.unionPatterns = [];
        this.conjunctivePatterns = [];
        var createTriple = function (property, branch) {
            return [_this.name(), property, branch.name()];
        };
        var createInverseTriple = function (property, branch) {
            return [branch.name(), property, _this.name()];
        };
        this.rootName = rootName;
        this.branchPattern = new GraphPatternWithBranches(createTriple);
        this.inverseBranchPattern = new GraphPatternWithBranches(createInverseTriple);
        this.optionalBranchPattern = new GraphPatternWithBranches(createTriple);
        this.optionalInverseBranchPattern = new GraphPatternWithBranches(createInverseTriple);
    }
    TreeGraphPattern.prototype.getDirectTriples = function () {
        var _this = this;
        var triples = [];
        var _loop_1 = function(property) {
            var leaves = this_1.valueLeaves[property];
            leaves.forEach(function (leaf) {
                triples.push([_this.name(), property, "\"" + leaf.value + "\""]);
            });
        };
        var this_1 = this;
        for (var property in this.valueLeaves) {
            _loop_1(property);
        }
        triples.push.apply(triples, this.branchPattern.getDirectTriples());
        triples.push.apply(triples, this.inverseBranchPattern.getDirectTriples());
        return triples;
    };
    TreeGraphPattern.prototype.getBranchPatterns = function () {
        var branches = [];
        branches.push.apply(branches, this.branchPattern.getBranchPatterns());
        branches.push.apply(branches, this.inverseBranchPattern.getBranchPatterns());
        return branches;
    };
    TreeGraphPattern.prototype.getOptionalPatterns = function () {
        var _this = this;
        var patterns = [];
        var addBranch = function (property, branch) {
            var gp = new TreeGraphPattern(_this.name());
            gp.branch(property, branch);
            patterns.push(gp);
        };
        var addInverseBranch = function (property, branch) {
            var gp = new TreeGraphPattern(_this.name());
            gp.inverseBranch(property, branch);
            patterns.push(gp);
        };
        this.optionalBranchPattern.enumerateBranches(addBranch);
        this.optionalInverseBranchPattern.enumerateBranches(addInverseBranch);
        return patterns;
    };
    TreeGraphPattern.prototype.getUnionPatterns = function () {
        return this.unionPatterns;
    };
    TreeGraphPattern.prototype.getConjunctivePatterns = function () {
        return this.conjunctivePatterns;
    };
    TreeGraphPattern.prototype.name = function () {
        return this.rootName;
    };
    TreeGraphPattern.prototype.branch = function (property, arg) {
        switch (typeof arg) {
            case "undefined":
            case "object":
                if (arg instanceof ValueLeaf) {
                    if (this.valueLeaves[property] !== undefined)
                        this.valueLeaves[property].push(arg);
                    else
                        this.valueLeaves[property] = [arg];
                    return;
                }
                else
                    return this.branchPattern.branch(property, arg);
            case "string":
                var pat = new TreeGraphPattern(arg);
                return this.branch(property, pat);
            default:
                throw new Error("branch argument is neither string nor TreeGraphPattern respective ValueLeaf");
        }
    };
    TreeGraphPattern.prototype.inverseBranch = function (property, arg) {
        switch (typeof arg) {
            case "undefined":
            case "object":
                return this.inverseBranchPattern.branch(property, arg);
            case "string":
                var pat = new TreeGraphPattern(arg);
                return this.inverseBranchPattern.branch(property, pat);
            default:
                throw new Error("branch argument is neither string nor object");
        }
    };
    TreeGraphPattern.prototype.optionalBranch = function (property, arg) {
        switch (typeof arg) {
            case "undefined":
            case "object":
                return this.optionalBranchPattern.branch(property, arg);
            case "string":
                var pat = new TreeGraphPattern(arg);
                return this.optionalBranchPattern.branch(property, pat);
            default:
                throw new Error("branch argument is neither string nor object");
        }
    };
    TreeGraphPattern.prototype.optionalInverseBranch = function (property, arg) {
        switch (typeof arg) {
            case "undefined":
            case "object":
                return this.optionalInverseBranchPattern.branch(property, arg);
            case "string":
                var pat = new TreeGraphPattern(arg);
                return this.optionalInverseBranchPattern.branch(property, pat);
            default:
                throw new Error("branch argument is neither string nor object");
        }
    };
    TreeGraphPattern.prototype.newUnionPattern = function (pattern) {
        pattern = pattern || new TreeGraphPattern(this.name());
        this.unionPatterns.push(pattern);
        return pattern;
    };
    /** Create a graph pattern with independent root variable. Append it with AND, i.e. " . " */
    TreeGraphPattern.prototype.newConjunctivePattern = function (pattern) {
        pattern = pattern || new TreeGraphPattern(this.name());
        this.conjunctivePatterns.push(pattern);
        return pattern;
    };
    TreeGraphPattern.prototype.branchExists = function (property) {
        return this.branchPattern.branch(property).length > 0;
    };
    TreeGraphPattern.prototype.merge = function (other) {
        if (this.rootName !== other.rootName)
            throw new Error("can\'t merge trees with different roots");
        this.branchPattern.merge(other.branchPattern);
        this.inverseBranchPattern.merge(other.inverseBranchPattern);
        this.optionalBranchPattern.merge(other.optionalBranchPattern);
        /* @todo unions */
    };
    return TreeGraphPattern;
}());
exports.TreeGraphPattern = TreeGraphPattern;
var GraphPatternWithBranches = (function () {
    function GraphPatternWithBranches(createTriple) {
        this.branches = {};
        this.createTriple = createTriple;
    }
    GraphPatternWithBranches.prototype.branch = function (property, arg) {
        switch (typeof arg) {
            case "undefined":
                return this.branches[property] || [];
            case "object":
                if (this.branches[property] !== undefined)
                    this.branches[property].push(arg);
                else
                    this.branches[property] = [arg];
                return arg;
            default:
                throw new Error("branch argument was specified but is no object");
        }
    };
    GraphPatternWithBranches.prototype.getDirectTriples = function () {
        var _this = this;
        var triples = [];
        this.enumerateBranches(function (property, branch) {
            triples.push(_this.createTriple(property, branch));
        });
        return triples;
    };
    GraphPatternWithBranches.prototype.getBranchPatterns = function () {
        var patterns = [];
        this.enumerateBranches(function (property, branch) { return patterns.push(branch); });
        return patterns;
    };
    GraphPatternWithBranches.prototype.enumerateBranches = function (fn) {
        var _loop_2 = function(property) {
            var branches = this_2.branches[property];
            branches.forEach(function (branch) { return fn(property, branch); });
        };
        var this_2 = this;
        for (var property in this.branches) {
            _loop_2(property);
        }
    };
    GraphPatternWithBranches.prototype.merge = function (other) {
        var _this = this;
        other.enumerateBranches(function (property, branch) {
            _this.branch(property, branch);
        });
    };
    return GraphPatternWithBranches;
}());
exports.GraphPatternWithBranches = GraphPatternWithBranches;
var ValueLeaf = (function () {
    function ValueLeaf(value) {
        this.value = value;
    }
    return ValueLeaf;
}());
exports.ValueLeaf = ValueLeaf;

//# sourceMappingURL=../../../maps/src/odata/graphpatterns.js.map
