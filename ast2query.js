module.exports = { getQueryFromSyntaxTree: getQueryFromSyntaxTree };

var queries = require('./queries');
var navi = require('../abnfjs/ast-navigator');
var queryFactory = require('./dbqueryfactory');

function getQueryFromSyntaxTree(ast, schema) {
  return getQueryFromCondensedSyntaxTree(ast.evaluate(), schema);
}

function getQueryFromCondensedSyntaxTree(ast, schema) {
    var fty = getQueryStackWithFactory(ast, schema);
    return new queries.EntitySetQuery({ entitySetName: fty.entitySetName, navigationStack: fty.path, filterOption: fty.filterOption });
}

function getQueryStackWithFactory(ast, schema) {
  if(ast.type == 'resourceQuery') {
    if(ast.resourcePath.type !== 'entitySet') throw new Error('unsupported resource path type: ' + ast.resourcePath.type);
    if(ast.resourcePath.navigation && ast.resourcePath.navigation.qualifiedEntityTypeName) throw new Error('qualified entity type name not supported');
    
    var fty = new queryFactory.DbQueryFactory(ast.resourcePath.entitySetName, schema);
    fty.filter(ast.queryOptions.filter);
    fty.expand(ast.queryOptions.expand);
    switch(ast.resourcePath.navigation.type) {
      case 'none':
        return fty;
      case 'collection-navigation':
        var navPath = ast.resourcePath.navigation.path;
        var key = parseInt(navPath.keyPredicate.simpleKey.value); //TODO: check type
        fty.selectById(key);
        if(navPath.singleNavigation) {
          fty.selectProperty(navPath.singleNavigation.propertyPath.propertyName);
        }
        return fty;
      default:
        throw new Error('this resourcePath navigation type is not supported');
    }
  }
  else throw new Error('unsupported query type: ' + ast.type);
}