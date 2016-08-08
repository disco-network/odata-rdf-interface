import base = require("../queries");
import filters = require("../filters");
import propertyTreeConfig = require("./propertytree");
import sparqlBuilderConfig = require("../../sparql/configuration/querystringbuilder");

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

export class FilterExpressionFactory extends filters.FilterExpressionIoCContainer {
  constructor() {
    super();
    this.registerFilterExpressions([
      filters.AndExpressionFactory, filters.OrExpressionFactory, filters.EqExpressionFactory,
      filters.StringLiteralExpressionFactory, filters.NumberLiteralExpressionFactory,
      filters.ParenthesesExpressionFactory,
      new filters.PropertyExpressionFactory(propertyTreeConfig.getFilterGraphPatternStrategy()),
    ]);
  }
}
