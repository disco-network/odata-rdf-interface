var metadata = require('./metadata');
var exports = module.exports = {};

var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    __.prototype = b.prototype;
    d.prototype = new __();
};

var Query = exports.Query = (function() {
	function Query() {}
	Query.prototype.run = function(db) { throw new Error('not implemented') };
	Query.prototype.sendResults = function(res) { throw new Error('not implemented') };
	return Query;
})();

var UnsupportedQuery = exports.UnsupportedQuery = (function(_super) {
	__extends(UnsupportedQuery, _super)
	function UnsupportedQuery(text) { this.text = text }
	Query.prototype.run = function(db) {};
	Query.prototype.sendResults = function(res, body) {
	  console.trace();
		res.statusCode = 400;
		res.end('unsupported query: \n' + this.text && this.text.toString());
	};
	return UnsupportedQuery;
})(Query);

var EntitySetQuery = exports.EntitySetQuery = (function(_super) {
  __extends(EntitySetQuery, _super);
  function EntitySetQuery(args) {
    this.args = args;
  }
  
  EntitySetQuery.prototype.run = function(db) {
    var schema = db.getSchema();
    var currentSchema = schema.entitySets[this.args.entitySetName];
    if(!currentSchema) return { error: ErrorTypes.ENTITYSET_NOTFOUND };
    var firstPrimitiveQuery = new PrimitiveQuery_EntitySet(this.args.entitySetName, this.args.navigationStack, 0, this.args.filterOption); //only apply filter if many items wanted
    var secondPrimitiveQuery;
    this.result = firstPrimitiveQuery.getResult(db);
    if(this.args.navigationStack.length > firstPrimitiveQuery.getLength()) {
      secondPrimitiveQuery = new PrimitiveQuery_Entity(this.args.entitySetName, this.result.result, this.args.navigationStack, firstPrimitiveQuery.getLength());
      this.result = secondPrimitiveQuery.getResult(db);
      if(this.args.navigationStack.length > (firstPrimitiveQuery.getLength()+secondPrimitiveQuery.getLength()))
        throw new Error('unsupported resource path');
    }
  }
  
  EntitySetQuery.prototype.sendResults = function(res) {
		if(!this.result.error) res.end(JSON.stringify(this.result.result, null, 2));
		else handleErrors(this.result, res);
  }
  return EntitySetQuery;
})(Query);

//A helper query to retrieve a collection or an element of a collection
var PrimitiveQuery_Base = (function() {
  function PrimitiveQuery_Base() {};
  PrimitiveQuery_Base.prototype.getLength = function() { throw new Error('not implemented') };
  PrimitiveQuery_Base.prototype.getResult = function() { throw new Error('not implemented') };
  return PrimitiveQuery_Base;
})();

var PrimitiveQuery_EntitySet = (function(_super) {
  __extends(PrimitiveQuery_EntitySet, _super);
  function PrimitiveQuery_EntitySet(entitySetName, navigationStack, stackPos, filterOption) {
    this._len = 0;
    this.entitySetName = entitySetName;
    this.filterOption = filterOption;
    if(navigationStack[stackPos] && navigationStack[stackPos].type == 'by-id') {
      this.byId = true;
      this.id = navigationStack[stackPos].id;
      this._len++;
    }
  };
  PrimitiveQuery_EntitySet.prototype.getLength = function() { return this._len };
  PrimitiveQuery_EntitySet.prototype.getResult = function(db) {
    if(!this.byId) {
      var dbResult = db.getEntities(this.entitySetName, this.filterOption);
      if(!dbResult.error) return { result: dbResult.result };
      else return { error: ErrorTypes.DB, errorDetails: dbResult.error };
    }
    else {
      var dbResult = db.getSingleEntity(this.entitySetName, this.id);
      if(!dbResult.error) return { result: dbResult.result.entity };
      else return { error: ErrorTypes.DB, errorDetails: dbResult.error };
    }
  };
  return PrimitiveQuery_EntitySet;
})(PrimitiveQuery_Base);

var PrimitiveQuery_Entity = (function(_super) {
  __extends(PrimitiveQuery_Entity, _super);
  function PrimitiveQuery_Entity(entitySetName, entity, navigationStack, stackPos) {
    this.entitySetName = entitySetName;
    this.entity = entity;
    this.primitiveStack = [ ];
    var upperNavigation = navigationStack[stackPos];
    if(upperNavigation && upperNavigation.type == 'property') this.primitiveStack.push(upperNavigation);
    else throw new Error('unexpected type of resource path segment or unexpected end of resource path');
  };
  PrimitiveQuery_Entity.prototype.getLength = function() { return this.primitiveStack.length };
  PrimitiveQuery_Entity.prototype.getResult = function(db) {
    var property = this.primitiveStack[0];
    var schema = db.getSchema();
    var entitySetSchema = schema.entitySets[this.entitySetName];
    var entitySchema = schema.entityTypes[entitySetSchema.type];
    var dbResult = db.getProperty(entitySchema, this.entity, property.name);
    return { result: dbResult };
  };
  return PrimitiveQuery_Entity;
})(PrimitiveQuery_Base);

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