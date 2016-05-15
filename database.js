var exports = module.exports = {};

var Database = exports.Database = (function() {
	function Database() {
		this.data = {
			"Posts": {
				values: [
					{ Id: 1, ContentId: 1, ParentId: null },
					{ Id: 2, ContentId: 1, ParentId: 1 },
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
		
		this.schema = {
		  entityTypes: {
		    Post: {
		      properties: {
		        Id: { autoIncrement_nextValue: 3, type: "Edm.Int64" },
		        ContentId: { type: "Edm.Int64" },
		        ParentId: { type: "Edm.Int64", correspondingNavigationProperty: "Parent" },
		        Parent: { type: "Post", quantity: "one-to-many", indexProperty: "ParentId", foreignSet: "Posts" },
		        Children: { type: "Post", quantity: "many-to-one", foreignSet: "Posts", foreignProperty: "Parent" },
		      }
		    },
		  },
		  entitySets: {
		    Posts: {
		      type: "Post"
		    }
		  }
		};
	}
	
	Database.prototype.getSchema = function() { return this.schema };
	
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
	
	Database.prototype.getEntities = function(entitySetName, args /* := filterOption, expandTree */) { //TODO: result format
		var entitySet = this.data[entitySetName];
		var entitySetSchema = this.schema.entitySets[entitySetName];
		if(entitySet) {
			var filteredEntities = this.filterEntities(this.schema.entityTypes[entitySetSchema.type], entitySet.values, args.filterOption);
			return new Result(this.expandAndCloneEntities(this.schema.entityTypes[entitySetSchema.type], filteredEntities, args.expandTree));
		}
		else return new Result(null, Errors.TABLE_NOTFOUND);
	}
	
	return Database;
})();

Database.prototype.filterEntities = function(entityTypeSchema, entities, filter) {
  var self = this;
  return entities.filter(function(e) { return self.evalFilter(entityTypeSchema, e, filter).value });
}

// we need cloning to avoid changing our database
Database.prototype.expandAndCloneEntities = function(entityTypeSchema, entities, expandTree) {
  var self = this;
  return entities.map(function(entity) {
    return self.expandAndCloneEntity(entityTypeSchema, entity, expandTree);
  })
}

Database.prototype.expandAndCloneEntity = function(entityTypeSchema, entity, expandTree) {
  var self = this;
  var clonedEntity = cloneJsonEntity(entity);
  //var expandProperties = Object.keys(expandTree);
  var propertySchema;
  for(var property in expandTree) {
    propertySchema = entityTypeSchema.properties[property];
    if(this.isNavigationProperty(entityTypeSchema, property)) {
      var result = this.getProperty(entityTypeSchema, clonedEntity, property);
      if(this.isCollectionProperty(entityTypeSchema, property)) {
        var innerEntityTypeSchema = self.schema.entityTypes[entityTypeSchema.properties[property].type];
        var innerExpandTree = expandTree[property];
        result = result.map(function(resultEntity) { 
          return self.expandAndCloneEntity(innerEntityTypeSchema, resultEntity, innerExpandTree);
        });
      }
      else
        result = self.expandAndCloneEntity(innerEntityTypeSchema, result, innerExpandTree);
      clonedEntity[property] = result;
    }
    else throw new Error('can only expand navigation properties ' + property);
  }
  return clonedEntity;
}

function cloneJsonEntities(entities) {
  return entities.map(cloneJsonEntity);
}
module.exports.cloneJsonEntities = cloneJsonEntities;

function cloneJsonEntity(entity) {
  //TODO: avoid endless recursion
  var ret = {};
  for(var key in entity) {
    switch(typeof entity[key]) {
      case 'object':
        if(isArray(entity[key])) ret[key] = entity[key].map(function(e) { return cloneJsonEntity(e) });
        else if(entity[key] == null) ret[key] = null;
        else ret[key] = cloneJsonEntity(entity[key]);
        break;
      case 'number':
      case 'string':
        ret[key] = entity[key];
        break;
      case 'undefined':
        ret[key] = undefined;
        break;
      default:
        throw new Error('unsupported json entity property ' + key + ': ' + entity[key]);
    }
  }
  return ret;
}
module.exports.cloneJsonEntity = cloneJsonEntity;

function isArray(any) {
  return Object.prototype.toString.call(any) == '[object Array]';
}

Database.prototype.evalFilter = function(schema, entity, filter) {
  var self = this;
  switch(filter && filter.type) {
    case null:
    case undefined:
      return { type: "Edm.Boolean", value: true };
    case 'operator':
      var lhs = self.evalFilter(schema, entity, filter.lhs);
      var rhs = self.evalFilter(schema, entity, filter.rhs);
      switch(filter.op) {
        //TODO: type checking + excluding of complex objects
        case 'and':
          return { type: "Edm.Boolean", value: lhs.value && rhs.value };
        case 'or':
          return { type: "Edm.Boolean", value: lhs.value || rhs.value };
        case 'eq':
          return { type: "Edm.Boolean", value: lhs.value == rhs.value };
        case 'ne':
          return { type: "Edm.Boolean", value: lhs.value != rhs.value };
        case 'lt':
          return { type: "Edm.Boolean", value: lhs.value < rhs.value };
        case 'le':
          return { type: "Edm.Boolean", value: lhs.value <= rhs.value };
        case 'gt':
          return { type: "Edm.Boolean", value: lhs.value > rhs.value };
        case 'ge':
          return { type: "Edm.Boolean", value: lhs.value >= rhs.value };
        default: throw new Error('not implemented');
      }
    case 'member-expression':
      return self.evalFirstMemberExpr(schema, entity, filter)
    case 'booleanValue':
      return { type: "Edm.Boolean", value: filter.value };
    case 'decimalValue':
      return { type: "Edm.Decimal", value: filter.value };
    case 'string':
    default:
      throw new Error('not implemented: ' + JSON.stringify(filter));
  }
}

Database.prototype.evalFirstMemberExpr = function(schema, entity, expr) {
  var self = this;
  //TODO: lambda expressions
  if(expr.variable != null && expr.variable != '$it') throw new Error('unrecognized in-scope variable');
  var variable = entity;
  var variableSchema = schema;
  return self.evalRelativeMemberExpr(variableSchema, variable, expr.path);
}

Database.prototype.evalRelativeMemberExpr = function(schema, entity, expr) {
  var self = this;
  var property = expr.propertyName;
  if(expr.collectionNavigation || expr.complexPath || expr.primitivePath || expr.complexColPath)
    throw new Error('unsupported member expression');
    
  var val = this.getProperty(schema, entity, property);
  
  //TODO: security and error handling below
  if(expr.singleNavigation)
    return self.evalRelativeMemberExpr(this.schema.entityTypes[schema.properties[property].type], val, expr.singleNavigation)
  else if(expr.collectionPath) {
    return { type: "Edm.Int64", value: val.length };
  }
  else
    return { type: schema.properties[property].type, value: val };
}

Database.prototype.getProperty = function(schema, entity, property, filter) { //TODO: use filter
  if(!entity) return null;
  if(this.isNavigationProperty(schema, property)) {
    switch(schema.properties[property].quantity) {
      case 'one-to-one':
      case 'one-to-many':
        var index = entity[schema.properties[property].indexProperty];
        if(index != null) {
          var result = this.getSingleEntity(schema.properties[property].foreignSet, index);
          if(!result.error) return result.result.entity;
          else throw new Error('no error handling implemented');
        }
        else return null;
      case 'many-to-one':
        var foreignSet = schema.properties[property].foreignSet;
        var foreignProperty = schema.properties[property].foreignProperty;
        var type = schema.properties[property].type;
        var foreignIndexProperty = this.schema.entityTypes[type].properties[foreignProperty].indexProperty;
        var result = this.getReferringEntities(foreignSet, foreignIndexProperty, entity.Id);
        if(!result.error) return result.result.entities;
        else throw new Error('no error handling implemented');
      default:
        throw new Error('not implemented');
    }
  }
  else {
    return entity[property];
  }
}

Database.prototype.isNavigationProperty = function(schema, name) {
  return schema.properties[name].type.substr(0,4) !== "Edm.";
}

Database.prototype.isCollectionProperty = function(schema, name) {
  return schema.properties[name].quantity.substr(0,5) === 'many-';
}

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