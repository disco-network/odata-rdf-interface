import * as base from "../../adapter/odatarepository";

import * as propertyTreeConfig from "./propertytree";
import * as sparqlBuilderConfig from "../sparql/querystringbuilder";
import { FilterExpressionFactory, IVisitor } from "./filters";

import * as postQueries from "../../adapter/postquery";
import { ISparqlProvider } from "../../sparql/sparql_provider_base";
import {
  InsertQueryStringBuilder as BaseInsertQueryStringBuilder,
} from "../../sparql/querystringbuilder";
import { PrefixBuilder } from "../sparql/querystringbuilder";

export class ODataRepository extends base.ODataRepository<IVisitor> {
  constructor(sparqlProvider: ISparqlProvider) {
    super(sparqlProvider, new GetQueryStringBuilder(), new PostQueryStringBuilder(), new InsertQueryStringBuilder());
  }
}

export class GetQueryStringBuilder extends base.GetQueryStringBuilder<IVisitor> {
  constructor() {
    super(new FilterExpressionFactory(),
      propertyTreeConfig.getFilterGraphPatternStrategy(), propertyTreeConfig.getExpandTreeGraphPatternStrategy(),
      new sparqlBuilderConfig.SelectQueryStringBuilder());
  }
}

export class InsertQueryStringBuilder extends BaseInsertQueryStringBuilder {
  constructor() {
    super(new PrefixBuilder());
  }
}

export class PostQueryStringBuilder extends postQueries.QueryStringBuilder {
  constructor() {
    super();
  }
}
