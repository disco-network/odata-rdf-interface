// @smell file is in /odata/ but requires /adapter/ modules
import {
  GetQueryStringBuilder as GetQueryStringBuilderInjectable, ODataRepository as ODataRepositoryInjectable,
} from "../../adapter/odatarepository";
import postQueries = require("../../adapter/postquery");
import sparqlProvider = require("../../sparql/sparql_provider_base");
import { SelectQueryStringBuilder } from "../../sparql/configuration/querystringbuilder";
import { FilterExpressionFactory } from "../../adapter/configuration/odatarepository";
import {
  getExpandTreeGraphPatternStrategy, getFilterGraphPatternStrategy,
} from "../../adapter/configuration/propertytree";

export class ODataRepository extends ODataRepositoryInjectable {
  constructor(sparqlProvider: sparqlProvider.ISparqlProvider) {
    super(sparqlProvider, new GetQueryStringBuilder(), new postQueries.QueryStringBuilder());
  }
}

export class GetQueryStringBuilder extends GetQueryStringBuilderInjectable {
  constructor() {
    super(new FilterExpressionFactory(), getFilterGraphPatternStrategy(),
          getExpandTreeGraphPatternStrategy(), new SelectQueryStringBuilder());
  }
}
