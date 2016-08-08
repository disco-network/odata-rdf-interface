import base = require("../queries");
import filters = require("../filters");
import propertyTreeConfig = require("./propertytree");

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

export class EntitySetQuery extends base.EntitySetQuery {
  constructor(model: base.IQueryAdapterModel) {
    super(model, new FilterExpressionFactory(),
      propertyTreeConfig.getFilterGraphPatternStrategy(), propertyTreeConfig.getExpandTreeGraphPatternStrategy());
  }
}
