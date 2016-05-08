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
		res.statusCode = 400;
		res.end('unsupported query' + (this.text ? (': ' + this.text) : ''));
	};
	return UnsupportedQuery;
})(Query);

var GetSingleEntityQuery = exports.GetSingleEntityQuery = (function(_super) {
	__extends(GetSingleEntityQuery, _super);
	function GetSingleEntityQuery(expression) {
		this.expression = expression;
	}
	GetSingleEntityQuery.prototype.run = function(db) {
		var dbResult = db.getSingleEntity(this.expression.entitySet, this.expression.key);
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

var GetSingleEntityPropertyQuery = exports.GetSingleEntityPropertyQuery = (function(_super) {
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
})(Query);

var GetManyEntitiesQuery = exports.GetManyEntitiesQuery = (function(_super) {
	__extends(GetManyEntitiesQuery, _super);
	function GetManyEntitiesQuery(expression) {
		this.expression = expression;
	}
	GetManyEntitiesQuery.prototype.run = function(db) { //IDEA: method checkSemantically
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