/** @module */
var _ = require('../util')

var Query = _.defClass(null,
function Query() {},
{
  run: _.notImplemented,
  sendResults: _.notImplemented
})

var QueryModel = _.defClass(null,
function QueryModel() { },
{
  entitySetName: null, /* the variable defaults are stored in the prototype */
  path: null, /** navigation path */
  filterOption: null,
  expandTree: null
})

/** This class can be used to generate odata output from different sources.
 * The concrete database logic is handled by the result and context parameters.
 */
var QueryResultEvaluator = _.defClass(null,
function QueryResultEvaluator() { },
{
  // result type corresponds to what's needed by the context instance
  evaluate: function(result, context) {
    var self = this;
    var ret = {};
    context.forEachElementaryPropertyOfResult(result, function(value, property) {
      ret[property.getName()] = value;
    });
    context.forEachComplexPropertyOfResult(result, function(subResult, property) {
      ret[property.getName()] = self.evaluate(subResult, context.getSubContext(property.getName()));
    });
    return ret;
  }
})

var QueryContext = _.defClass(null,
function QueryContext() { },
{
  forEachElementaryPropertyOfResult: _.notImplemented,
  forEachComplexPropertyOfResult: _.notImplemented,
});

var ErrorTypes = {
	NONE: 0,
	DB: 1,
	ENTITYSET_NOTFOUND: 2,
	PROPERTY_NOTFOUND: 3,
}

module.exports = {
  Query: Query,
  QueryModel: QueryModel,
  QueryResultEvaluator: QueryResultEvaluator,
  QueryContext: QueryContext,
  ErrorTypes: ErrorTypes,
};
