// @smell file is in /odata/ but requires /adapter/ modules
import base = require("../../adapter/odatarepository");
import postQueries = require("../../adapter/postquery");
import sparqlProvider = require("../../sparql/sparql_provider_base");

export class ODataRepository extends base.ODataRepository {
  constructor(sparqlProvider: sparqlProvider.ISparqlProvider) {
    super(sparqlProvider, new postQueries.QueryStringBuilder());
  }
}
