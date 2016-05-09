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

var GetSingleEntityQuery = exports.GetSingleEntityQuery = (function(_super) {
	__extends(GetSingleEntityQuery, _super);
	function GetSingleEntityQuery(expression) {
		this.expression = expression;
		this.key = expression.navPath.keyPredicate.simpleKey;
		//this.propertyName = expression.navPath.singleNavigation.propertyPath.propertyName;
	}
	GetSingleEntityQuery.prototype.run = function(db) {
		var dbResult = db.getSingleEntity(this.expression.entitySet, this.key);
		if(!dbResult.error) {
			this.result = { entity: dbResult.result.entity };
		}
		else {
			this.result = { error: ErrorTypes.DB, errorDetails: dbResult.error };
		}
	};
	GetSingleEntityQuery.prototype.sendResults = function(res) {
		if(!this.result.error) res.end(JSON.stringify(this.result.entity));
		else handleErrors(this.result, res);
	};
	return GetSingleEntityQuery;
})(Query);

/*var GetSingleEntityPropertyQuery = exports.GetSingleEntityPropertyQuery = (function(_super) {
	__extends(GetSingleEntityPropertyQuery, _super);
	function GetSingleEntityPropertyQuery(expression) {
		this.expression = expression;
		//TODO: check entitySet name correctness!
		this.propertyMetadata = metadata.Metadata.entitySets[this.expression.entitySet].navigationProperties[this.expression.property];
	}
	GetSingleEntityPropertyQuery.prototype.run = function(db) {
		if(this.propertyMetadata) {
			switch(this.propertyMetadata.HowMany) {
				case metadata.HowMany.ONE_TO_ONE:
					var dbResult = db.getOneToOneNavigationProperty(this.expression.entitySet, this.expression.id, this.expression.property, this.propertyMetadata);
					if(!dbResult.error) this.result = { result: dbResult.result.entity };
					else this.result = { error: ErrorTypes.DB, errorDetails: dbResult.error };
					break;
				case metadata.HowMany.ONE_TO_MANY:
					var dbResult = db.getOneToManyNavigationProperty(this.expression.entitySet, this.expression.id, this.expression.property, this.propertyMetadata);
					if(!dbResult.error) this.result = { result: dbResult.result.entities };
					else this.result = { error: ErrorTypes.DB, errorDetails: dbResult.error };
					break;
				default:
					//TODO: #!@dfgkls!##
					break;
			}
		}
		else {
			this.result = { error: ErrorTypes.PROPERTY_NOTFOUND }
		}
	};
	GetSingleEntityPropertyQuery.prototype.sendResults = function(res) {
		if(!this.result.error) res.end(JSON.stringify(this.result.result));
		else handleErrors(this.result, res);
	};
	
	return GetSingleEntityPropertyQuery;
})(Query);*/

var EntitySetQuery = exports.EntitySetQuery = (function(_super) {
  __extends(EntitySetQuery, _super);
  function EntitySetQuery(args) {
    this.args = args;
  }
  
  EntitySetQuery.prototype.run = function(db) {
    var schema = db.getSchema();
    console.log('ok1');
    var currentSchema = schema.entitySets[this.args.entitySetName];
    if(!currentSchema) return { error: ErrorTypes.ENTITYSET_NOTFOUND };
    var firstPrimitiveQuery = new PrimitiveQuery_EntitySet(this.args.entitySetName, this.args.navigationStack, 0, this.args.filterOption);
    this.result = firstPrimitiveQuery.getResult(db);
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
      if(!dbResult.error) return { result: dbResult.result };
      else return { error: ErrorTypes.DB, errorDetails: dbResult.error };
    }
  };
  return PrimitiveQuery_EntitySet;
})(PrimitiveQuery_Base);

var GetManyEntitiesQuery = exports.GetManyEntitiesQuery = (function(_super) {
	__extends(GetManyEntitiesQuery, _super);
	function GetManyEntitiesQuery(expression) {
		this.expression = expression;
	}
	GetManyEntitiesQuery.prototype.run = function(db) { //IDEA: method checkSemantically
	   console.log('ok2');
		var meta = metadata.Metadata.entitySets[this.expression.entitySet];
		if(meta) {
			var dbResult = db.getEntities(this.expression.entitySet, this.expression.filter);
			if(!dbResult.error) this.result = { result: dbResult.result };
			else this.result = { error: ErrorTypes.DB, errorDetails: dbResult.error };
		}
		else this.result = { error: ErrorTypes.ENTITYSET_NOTFOUND }
	}
	GetManyEntitiesQuery.prototype.sendResults = function(res) {
		if(!this.result.error) res.end(JSON.stringify(this.result.result));
		else handleErrors(this.result, res);
	}
	return GetManyEntitiesQuery;
})(Query);

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