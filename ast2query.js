var queries = require('./queries_sparql');
var queryComposer = require('./querycomposer');
var _ = require('./util');

function getQueryModelFromEvaluatedAst(/*evaluated*/ast, schema) {
  if(ast.type == 'resourceQuery') {
    if(ast.resourcePath.type !== 'entitySet') throw new Error('unsupported resource path type: ' + ast.resourcePath.type);
    if(ast.resourcePath.navigation && ast.resourcePath.navigation.qualifiedEntityTypeName) throw new Error('qualified entity type name not supported');

    var comp = new queryComposer.QueryComposer(ast.resourcePath.entitySetName, schema);
    comp.filter(ast.queryOptions.filter);
    comp.expand(ast.queryOptions.expand);
    switch(ast.resourcePath.navigation.type) {
      case 'none':
        return comp;
      case 'collection-navigation':
        var navPath = ast.resourcePath.navigation.path;
        var key = parseInt(navPath.keyPredicate.simpleKey.value); //TODO: check type
        comp.selectById(key);
        if(navPath.singleNavigation) {
          comp.selectProperty(navPath.singleNavigation.propertyPath.propertyName);
        }
        return comp;
      default:
        throw new Error('this resourcePath navigation type is not supported');
    }
  }
  else throw new Error('unsupported query type: ' + ast.type);
}

module.exports = { getQueryModelFromEvaluatedAst: getQueryModelFromEvaluatedAst };
