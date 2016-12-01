import * as base from "../../adapter/odatarepository";

import * as propertyTreeConfig from "./propertytree";
import { FilterExpressionTranslatorFactory, IMinimalVisitor } from "./filters";

import { ISparqlProvider } from "../../sparql/sparql_provider_base";
import {
  InsertQueryStringProducer as BaseInsertQueryStringBuilder,
} from "../../sparql/querystringproducer";
import { PrefixProducer, GraphPatternStringProducer, SelectQueryStringBuilder } from "../sparql/querystringproducer";
import { FilterFromPatternProducer } from "../../odata/filters/matchpattern";

export class ODataRepository extends base.ODataRepository<IMinimalVisitor> {
  constructor(serviceUri: string, sparqlProvider: ISparqlProvider, graphUri: string) {
    super(serviceUri, sparqlProvider, new GetQueryStringProducer(),
          new InsertQueryStringBuilder(graphUri), new PatchQueryStringProducerFactory());
  }
}

export class PatchQueryStringProducerFactory extends base.PatchQueryStringProducerFactory {
  constructor() {
    super(new PrefixProducer(), new WhereClauseProducer(), new FilterFromPatternProducer());
  }
}

export class GetQueryStringProducer extends base.GetQueryStringBuilder<IMinimalVisitor> {
  constructor() {
    super(new FilterExpressionTranslatorFactory(),
      propertyTreeConfig.getFilterGraphPatternStrategy(), propertyTreeConfig.getExpandTreeGraphPatternStrategy(),
      new SelectQueryStringBuilder());
  }
}

export class WhereClauseProducer extends base.WhereClauseProducer {
  constructor() {
    super(propertyTreeConfig.getExpandTreeGraphPatternStrategy(), new GraphPatternStringProducer(),
          new FilterExpressionTranslatorFactory());
  }
}

export class InsertQueryStringBuilder extends BaseInsertQueryStringBuilder {
  constructor(graphUri: string) {
    super(new PrefixProducer(), graphUri);
  }
}
