import base = require("../../adapter/odatarepository");
import filterTranslators = require("../../adapter/filtertranslators");
import propertyTreeConfig = require("./propertytree");
import sparqlBuilderConfig = require("../sparql/querystringbuilder");
import postQueries = require("../../adapter/postquery");
import { ISparqlProvider } from "../../sparql/sparql_provider_base";

export class ODataRepository extends base.ODataRepository {
  constructor(sparqlProvider: ISparqlProvider) {
    super(sparqlProvider, new GetQueryStringBuilder(), new PostQueryStringBuilder());
  }
}

export class GetQueryStringBuilder extends base.GetQueryStringBuilder {
  constructor() {
    super(new FilterExpressionFactory(),
      propertyTreeConfig.getFilterGraphPatternStrategy(), propertyTreeConfig.getExpandTreeGraphPatternStrategy(),
      new sparqlBuilderConfig.SelectQueryStringBuilder());
  }
}

export class PostQueryStringBuilder extends postQueries.QueryStringBuilder {
  constructor() {
    super();
  }
}

export class FilterExpressionFactory extends filterTranslators.FilterToTranslatorChainOfResponsibility {
  constructor() {
    super();
    this.pushHandlers([
      filterTranslators.AndTranslatorFactory, filterTranslators.OrTranslatorFactory,
      filterTranslators.EqTranslatorFactory,
      filterTranslators.StringLiteralTranslatorFactory, filterTranslators.NumericLiteralTranslatorFactory,
      filterTranslators.ParenthesesTranslatorFactory,
      new filterTranslators.PropertyTranslatorFactory(propertyTreeConfig.getFilterGraphPatternStrategy()),
    ]);
  }
}
