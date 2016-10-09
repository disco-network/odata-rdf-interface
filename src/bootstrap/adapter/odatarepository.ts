import * as base from "../../adapter/odatarepository";

import * as propertyTreeConfig from "./propertytree";
import * as sparqlBuilderConfig from "../sparql/querystringbuilder";
import { FilterExpressionTranslatorFactory, IMinimalVisitor } from "./filters";

import { ISparqlProvider } from "../../sparql/sparql_provider_base";
import {
  InsertQueryStringBuilder as BaseInsertQueryStringBuilder,
} from "../../sparql/querystringbuilder";
import { PrefixBuilder, GraphPatternStringBuilder } from "../sparql/querystringbuilder";
import { FilterFromPatternProducer } from "../../odata/filters/matchpattern";

export class ODataRepository extends base.ODataRepository<IMinimalVisitor> {
  constructor(sparqlProvider: ISparqlProvider, graphUri: string) {
    super(sparqlProvider, new GetQueryStringBuilder(),
          new InsertQueryStringBuilder(graphUri), new PatchQueryStringBuilderFactory());
  }
}

export class PatchQueryStringBuilderFactory extends base.PatchQueryStringBuilderFactory {
  constructor() {
    super(new PrefixBuilder(), propertyTreeConfig.getExpandTreeGraphPatternStrategy(), new GraphPatternStringBuilder(),
          new FilterExpressionTranslatorFactory(), new FilterFromPatternProducer());
  }
}

export class GetQueryStringBuilder extends base.GetQueryStringBuilder<IMinimalVisitor> {
  constructor() {
    super(new FilterExpressionTranslatorFactory(),
      propertyTreeConfig.getFilterGraphPatternStrategy(), propertyTreeConfig.getExpandTreeGraphPatternStrategy(),
      new sparqlBuilderConfig.SelectQueryStringBuilder());
  }
}

export class InsertQueryStringBuilder extends BaseInsertQueryStringBuilder {
  constructor(graphUri: string) {
    super(new PrefixBuilder(), graphUri);
  }
}
