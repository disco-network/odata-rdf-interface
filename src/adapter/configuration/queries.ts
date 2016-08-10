import base = require("../queries");
import filters = require("../filters");
import queryEngine = require("../../odata/query_engine");
import sparqlProvider = require("../../sparql/sparql_provider_base");
import propertyTreeConfig = require("./propertytree");
import sparqlBuilderConfig = require("../../sparql/configuration/querystringbuilder");
import odataParserConfig = require("../../odata/configuration/parser");
import entityReaderConfig = require("../../odata/configuration/entityreader");
import odataRepositoryConfig = require("../../odata/configuration/repository");

export class QueryEngine extends queryEngine.QueryEngine {
  constructor(sparqlProvider: sparqlProvider.ISparqlProvider) {
    super(new odataParserConfig.ODataParser(), new entityReaderConfig.EntityReader(),
          new odataRepositoryConfig.ODataRepository(sparqlProvider));
  }
}

export class EntitySetQuery extends base.EntitySetQuery {
  constructor(model: base.IQueryAdapterModel) {
    super(model, new EntitySetQueryStringBuilder());
  }
}

export class EntitySetQueryStringBuilder extends base.EntitySetQueryStringBuilder {
  constructor() {
    super(new FilterExpressionFactory(),
      propertyTreeConfig.getFilterGraphPatternStrategy(), propertyTreeConfig.getExpandTreeGraphPatternStrategy(),
      new sparqlBuilderConfig.SelectQueryStringBuilder());
  }
}

export class QueryFactory extends base.QueryFactory {
  constructor(model: base.IQueryAdapterModel) {
    super(model, m => new EntitySetQuery(m));
  }
}

export class FilterExpressionFactory extends filters.FilterToTranslatorChainOfResponsibility {
  constructor() {
    super();
    this.pushHandlers([
      filters.AndTranslatorFactory, filters.OrTranslatorFactory, filters.EqTranslatorFactory,
      filters.StringLiteralTranslatorFactory, filters.NumericLiteralTranslatorFactory,
      filters.ParenthesesTranslatorFactory,
      new filters.PropertyTranslatorFactory(propertyTreeConfig.getFilterGraphPatternStrategy()),
    ]);
  }
}
