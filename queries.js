var _ = require('./util')

var Query = _.defClass(null,
function Query() {},
{
  run: _.notImplemented,
  sendResults: _.notImplemented
})

var QueryModel = _.defClass(null,
function QueryModel() { },
{
  entitySetName: null,
  navigationStack: null,
  filterOption: null,
  expandTree: null
})

var ErrorTypes = {
	NONE: 0,
	DB: 1,
	ENTITYSET_NOTFOUND: 2,
	PROPERTY_NOTFOUND: 3,
}

module.exports = { Query: Query, QueryModel: QueryModel, ErrorTypes: ErrorTypes };
