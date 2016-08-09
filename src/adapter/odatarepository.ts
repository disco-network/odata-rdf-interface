import base = require("../odata/repository");
import schema = require("../odata/schema");
import results = require("../result");

import sparqlProvider = require("../sparql/sparql_provider_base");
import postQueries = require("../adapter/postquery");

export class ODataRepository implements base.IRepository {

  private sparqlProvider: sparqlProvider.ISparqlProvider;
  private postQueryStringBuilder: postQueries.IQueryStringBuilder;

  public insertEntity(entity: any, type: schema.EntityType, cb: (result: results.AnyResult) => void) {
    this.sparqlProvider.query(this.postQueryStringBuilder.build(entity, type), result => {
      cb(result.process(res => "ok", err => ({ message: "sparql error", error: err })));
    });
  }

  public setSparqlProvider(value: sparqlProvider.ISparqlProvider) {
    this.sparqlProvider = value;
  }

  public setPostQueryStringBuilder(value: postQueries.IQueryStringBuilder) {
    this.postQueryStringBuilder = value;
  }
}
