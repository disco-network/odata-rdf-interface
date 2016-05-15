var defClass = require('../abnfjs/classgenerator');
var exports = module.exports = {};

var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    __.prototype = b.prototype;
    d.prototype = new __();
};

var notImplemented = function() { throw new Error('not implemented') }

var Query = defClass(null,
function Query() {},
{
  run: notImplemented,
  sendResults: notImplemented
})

var Query = exports.Query = (function() {
	function Query() {}
	Query.prototype.run = function(db) { throw new Error('not implemented') };
	Query.prototype.sendResults = function(res) { throw new Error('not implemented') };
	return Query;
})();

var UnsupportedQuery = exports.UnsupportedQUery = defClass(Query,
function UnsupportedQuery(text) { this.text = text },
{
  run: function(db) {},
  sendResults: function(res, body) {
		res.statusCode = 400;
		res.end('unsupported query: \n' + this.text && this.text.toString());
  }
})

var EntitySetQuery = exports.EntitySetQuery = defClass(Query,
function EntitySetQuery(args /* := entitySetName, navigationStack, filterOption, expandTree */) { this.args = args },
{
  run: function(db) {
    var schema = db.getSchema();
    var currentSchema = schema.entitySets[this.args.entitySetName];
    if(!currentSchema) return { error: ErrorTypes.ENTITYSET_NOTFOUND };
    var firstPrimitiveQuery = new PrimitiveQuery_EntitySet(this.args.entitySetName, this.args.navigationStack, 0); //only apply filter if many items wanted
    var secondPrimitiveQuery;
    if(this.args.navigationStack.length > firstPrimitiveQuery.getLength()) {
      var firstResult = firstPrimitiveQuery.getResult(db);
      secondPrimitiveQuery = new PrimitiveQuery_Entity(this.args.entitySetName, firstResult.result, this.args.navigationStack, firstPrimitiveQuery.getLength());
      this.result = secondPrimitiveQuery.getResult(db);
      if(this.args.navigationStack.length > (firstPrimitiveQuery.getLength()+secondPrimitiveQuery.getLength()))
        throw new Error('unsupported resource path');
    }
    else {
      this.result = firstPrimitiveQuery.getResult(db, { filterOption: this.args.filterOption, expandTree: this.args.expandTree });
    }
  },
  sendResults: function(res) {
    if(!this.result.error) {
      res.writeHeader(200, {'Content-type': 'application/json' });
		  res.end(JSON.stringify(this.result.result, null, 2));
    }
    else handleErrors(this.result, res);
  }
})

//A helper query to retrieve a collection or an element of a collection
var PrimitiveQuery_Base = defClass(null,
function PrimitiveQuery_Base() {},
{
  getLength: notImplemented,
  getResult: notImplemented
})

var PrimitiveQuery_EntitySet = defClass(PrimitiveQuery_Base,
function PrimitiveQuery_EntitySet(entitySetName, navigationStack, stackPos) {
  this._len = 0;
  this.entitySetName = entitySetName;
  if(navigationStack[stackPos] && navigationStack[stackPos].type == 'by-id') {
    this.byId = true;
    this.id = navigationStack[stackPos].id;
    this._len++;
  }
},
{
  getLength: function() { return this._len },
  getResult: function(db, args /* := filterOption, expandTree */) {
    if(!this.byId) {
      var dbResult = db.getEntities(this.entitySetName, { filterOption: args.filterOption, expandTree: args.expandTree });
      if(!dbResult.error) return { result: dbResult.result };
      else return { error: ErrorTypes.DB, errorDetails: dbResult.error };
    }
    else {
      var dbResult = db.getSingleEntity(this.entitySetName, this.id);
      if(!dbResult.error) return { result: dbResult.result.entity };
      else return { error: ErrorTypes.DB, errorDetails: dbResult.error };
    }
  }
})

var PrimitiveQuery_Entity = defClass(PrimitiveQuery_Base,
function PrimitiveQuery_Entity(entitySetName, entity, navigationStack, stackPos) {
  this.entitySetName = entitySetName;
  this.entity = entity;
  this.primitiveStack = [ ];
  var upperNavigation = navigationStack[stackPos];
  if(upperNavigation && upperNavigation.type == 'property') this.primitiveStack.push(upperNavigation);
  else throw new Error('unexpected type of resource path segment or unexpected end of resource path');
},
{
  getLength: function() { return this.primitiveStack.length },
  getResult: function(db) {
    var property = this.primitiveStack[0];
    var schema = db.getSchema();
    var entitySetSchema = schema.entitySets[this.entitySetName];
    var entitySchema = schema.entityTypes[entitySetSchema.type];
    var dbResult = db.getProperty(entitySchema, this.entity, property.name);
    return { result: dbResult };
  }
})

function handleErrors(result, res) {
	switch(result.error) {
		case ErrorTypes.DB:
			res.statusCode = 500;
			res.end('database error ' + result.errorDetails);
			break;
		default:
			res.statusCode = 500;
			res.end('unknown error type ' + result.error);
	}
}

var ErrorTypes = {
	NONE: 0,
	DB: 1,
	ENTITYSET_NOTFOUND: 2,
	PROPERTY_NOTFOUND: 3,
}