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
  constructor(sparqlProvider: ISparqlProvider, graphUri: string) {
    super(sparqlProvider, new GetQueryStringBuilder(),
          new InsertQueryStringBuilder(graphUri), new PatchQueryStringBuilderFactory());
  }
}

export class PatchQueryStringBuilderFactory extends base.PatchQueryStringBuilderFactory {
  constructor() {
    super(new PrefixProducer(), propertyTreeConfig.getExpandTreeGraphPatternStrategy(),
          new GraphPatternStringProducer(),
          new FilterExpressionTranslatorFactory(), new FilterFromPatternProducer());
  }
}

export class GetQueryStringBuilder extends base.GetQueryStringBuilder<IMinimalVisitor> {
  constructor() {
    super(new FilterExpressionTranslatorFactory(),
      propertyTreeConfig.getFilterGraphPatternStrategy(), propertyTreeConfig.getExpandTreeGraphPatternStrategy(),
      new SelectQueryStringBuilder());
  }
}

export class InsertQueryStringBuilder extends BaseInsertQueryStringBuilder {
  constructor(graphUri: string) {
    super(new PrefixProducer(), graphUri);
  }
}
