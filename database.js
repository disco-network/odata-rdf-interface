var metadata = require('./metadata');
var exports = module.exports = {};

var Database = exports.Database = (function() {
	function Database() {
		this.data = {
			"Posts": {
				values: [
					{ Id: 1, ContentId: 1 },
					{ Id: 2, ContentId: 1 },
				]
			},
			"PostReferences": {
				values: [
					{ Id: 1, ReferrerId: 1 }
				]
			},
			"Content": {
				values: [
					{ Id: 1, Culture: "de-DE" }
				]
			},
		};
	}
	
	Database.prototype.getSingleEntity = function(entitySetName, id) {
		var entitySet = this.data[entitySetName];
		if(entitySet) {
			var entities = entitySet.values.filter(function(e) { return e.Id == id });
			if(entities.length == 1) {
				return new Result({ entity: entities[0] });
			}
			else if(entities.length == 0) return new Result(null, Errors.ENTITY_NOTFOUND);
			else return new Result(null, Errors.ENTITY_NOT_UNIQUE);
		}
		else return new Result(null, Errors.TABLE_NOTFOUND);
	}
	
	Database.prototype.getReferringEntities = function(entitySetName, propertyName, id) {
		var entitySet = this.data[entitySetName];
		if(entitySet) {
			var entities = entitySet.values.filter(function(e) { return e[propertyName] == id });
			return new Result({ entities: entities });
		}
		else return new Result(null, Errors.TABLE_NOTFOUND);
	}
	
	Database.prototype.getOneToOneNavigationProperty = function(entitySetName, id, propertyName, metadata) {
		var entityResult = this.getSingleEntity(entitySetName, id);
		if(!entityResult.error) {
			var propertyResult = this.getSingleEntity(metadata.EntitySet, entityResult.result.entity[metadata.IdProperty]);
			if(!propertyResult.error) return propertyResult;
			else return new Result(null, Errors.INTERNAL);
		}
		else return new Result(null, entityResult.error);
	}
	
	Database.prototype.getOneToManyNavigationProperty = function(entitySetName, id, propertyName, metadata) {
		//TODO: TABLE_NOTFOUND
		var entityResult = this.getSingleEntity(entitySetName, id);
		if(!entityResult.error) {
			var propertyResult = this.getReferringEntities(metadata.EntitySet, metadata.ReverseProperty, entityResult.result.entity.Id);
			if(!propertyResult.error) return propertyResult;
			else return new Result(null, Errors.INTERNAL);
		}
		else return new Result(null, entityResult.error);
	}
	
	Database.prototype.getEntities = function(entitySetName) {
		var entitySet = this.data[entitySetName];
		if(entitySet) {
			return new Result(entitySet.values);
		}
		else return new Result(null, Errors.TABLE_NOTFOUND);
	}
	
	return Database;
})();

var Result = exports.Result = (function() {
	function Result(result, error) {
		this.result = result;
		this.error = error;
	}
	return Result;
})();

var Errors = exports.Errors = {
	NONE: 0,
	INTERNAL: 1,
	TABLE_NOTFOUND: 2,
	ENTITY_NOTFOUND: 3,
	ENTITY_NOT_UNIQUE: 4,
	NOT_IMPLEMENTED: 5,
};