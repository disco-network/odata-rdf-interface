/** @module */
var _ = require('../util');

var SparqlProviderBase = _.defClass(null,
function SparqlProviderBase() { },
{
  querySelect: function(queryString, cb) { cb({ error: 'not implemented' }) }
});

module.exports = {
  SparqlProviderBase: SparqlProviderBase
}
