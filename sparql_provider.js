var _ = require('./util');
var base = require('./sparql_provider_base')

var SparqlProvider = _.defClass(base.SparqlProviderBase,
function SparqlProvider(rdfStore, graphName) { this.store = rdfStore; this.graphName = graphName },
{
  querySelect: function(queryString, cb) {
    //TODO: ensure that query has kind SELECT
    this.store.executeWithEnvironment(queryString, [this.graphName], [], function(err, results) {
      if(!err) {
        cb({ result: results });
      }
      else {
        cb({ error: err });
      }
    });
  }
});

module.exports = { SparqlProvider: SparqlProvider };