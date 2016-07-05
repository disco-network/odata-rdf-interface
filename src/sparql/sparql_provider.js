"use strict";
var SparqlProvider = (function () {
    function SparqlProvider(store, graphName) {
        this.store = store;
        this.graphName = graphName;
    }
    SparqlProvider.prototype.querySelect = function (queryString, cb) {
        //TODO: ensure that query has kind SELECT
        this.store.executeWithEnvironment(queryString, [this.graphName], [], function (err, results) {
            if (!err) {
                cb({ result: results });
            }
            else {
                cb({ error: err });
            }
        });
    };
    return SparqlProvider;
}());
exports.SparqlProvider = SparqlProvider;
