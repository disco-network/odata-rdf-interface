module.exports = { getQueryFromSyntaxTree: getQueryFromSyntaxTree };

var queries = require('./queries');
var navi = require('../abnfjs/ast-navigator');
var queryFactory = require('./dbqueryfactory');

function getQueryFromSyntaxTree(ast, schema) {
  return getQueryFromCondensedSyntaxTree(condenseSyntaxTree(ast), schema);
}

function getQueryFromCondensedSyntaxTree(ast, schema) {
  //try {
    var fty = getQueryStackWithFactory(ast, schema);
    return new queries.EntitySetQuery({ entitySetName: fty.entitySetName, navigationStack: fty.path, filterOption: fty.filterOption });
  //}
  //catch(e) {
    //return new queries.UnsupportedQuery(e);
  //}
}

function getQueryStackWithFactory(ast, schema) {
  if(ast.type == 'resourceQuery') {
    if(ast.resourcePath.type !== 'entitySet') throw new Error('unsupported resource path type: ' + ast.resourcePath.type);
    if(ast.resourcePath.navigation && ast.resourcePath.navigation.qualifiedEntityTypeName) throw new Error('qualified entity type name not supported');
    var fty = new queryFactory.DbQueryFactory(ast.resourcePath.entitySetName, schema);
    fty.filter(ast.queryOptions.filter);
    switch(ast.resourcePath.navigation.type) {
      case 'none':
        return fty;
      case 'collection-navigation':
        var navPath = ast.resourcePath.navigation.path;
        var key = navPath.keyPredicate.simpleKey;
        fty.selectById(key);
        if(navPath.singleNavigation)
          fty.selectProperty(navPath.singleNavigation.propertyPath.propertyName);
        return fty;
      default:
        throw new Error('resourcePath navigation type is not implemented');
    }
  }
  else throw new Error('unsupported query type: ' + ast.type);
}

function condenseSyntaxTree(ast) {
  ast = navi(ast);
  console.log(ast);
  var descriptors = ast.descriptors();
  if(descriptors.resourcePath) {
    return { type: 'resourceQuery', 
      resourcePath: condenseResourcePath(descriptors.resourcePath.singleItem()), 
      queryOptions: condenseQueryOptions(descriptors.queryOptions && descriptors.queryOptions.singleItem()) };
  }
  else throw new Error('unsupported');
}

function condenseResourcePath(resourcePath) {
  var descriptors = resourcePath.descriptors();
  var entitySetName = descriptors.entitySetName.singleItem();
  var navigation = condenseCollectionNavigation(descriptors.navigation && descriptors.navigation.singleItem());
  return { type: 'entitySet', entitySetName: entitySetName.str(), navigation: navigation };
}

function condenseCollectionNavigation(collectionNavigation) {
  var ret = { type: 'none' };
  if(!collectionNavigation) return ret;
  var descriptors = collectionNavigation.descriptors();
  var qualifiedEntityTypeName = descriptors.qualifiedEntityTypeName;
  var collectionNavPath = descriptors.collectionNavPath;
  
  if(qualifiedEntityTypeName) {
    throw new Error('qualified entity type names are not yet supported');
    var qualifiedEntityTypeNameExpression = qualifiedEntityTypeName.singleItem();
    ret.qualifiedEntityTypeName = {};
    ret.qualifiedEntityTypeName.namespace = qualifiedEntityTypeNameExpression.nthItem(0).str();
    ret.qualifiedEntityTypeName.entityTypeName = qualifiedEntityTypeNameExpression.nthItem(2).str();
  }
  if(collectionNavPath) {
    var collectionNavPathExpression = collectionNavPath.singleItem();
    var descriptors = collectionNavPathExpression.descriptors();
    ret.type = 'collection-navigation';
    ret.path = {};
    if(descriptors.keyPredicate) {
      ret.path.type = 'keyPredicate';
      ret.path.keyPredicate = {};
      var keyPredicateExpr = descriptors.keyPredicate.singleItem();
      var keyPredicateDescriptors = keyPredicateExpr.descriptors();
      if(keyPredicateDescriptors.simpleKey) {
        var simpleKey = keyPredicateDescriptors.simpleKey.singleItem().descriptors().value.str();
        ret.path.keyPredicate.type = 'simpleKey';
        ret.path.keyPredicate.simpleKey = parseInt(simpleKey);
        //TODO: key type
        if(descriptors.singleNavigation) {
          ret.path.singleNavigation = condenseSingleNavigation(descriptors.singleNavigation.singleItem());
        }
      }
      else throw new Error('unsupported');
    }
    else throw new Error('unsupported: collectionNavPath without keyPredicate');
  }
  return ret;
}

function condenseSingleNavigation(expr) {
  console.log('condense single navigation');
  console.log(expr.descriptors());
  return { propertyPath: condensePropertyPath(expr.descriptors().propertyPath.singleItem()) };
}

function condensePropertyPath(expr) {
  var desc = expr.descriptors();
  var propertyName = desc.propertyName.str();
  if(desc.collectionNavigation || desc.singleNavigation) throw new Error('unsupported');
  return { propertyName: propertyName };
}

function condenseQueryOptions(expr) {
  if(!expr) return {};
  var queryOptions = [expr.descriptors().firstQueryOption.singleItem()];
  var furtherQueryOptions = expr.descriptors().furtherQueryOptions || [];
  for(var i = 0; i < furtherQueryOptions.length; ++i) {
    if(furtherQueryOptions[i]) queryOptions.push(furtherQueryOptions[i].singleItem());
  }
  var opts = {};
  for(var i = 0; i < queryOptions.length; ++i) {
    var systemQueryOption = queryOptions[i].descriptors().systemQueryOption.singleItem(); //this might throw an error
    var selectedAlternative;
    if(selectedAlternative = systemQueryOption.descriptors().filter) {
      if(opts.filter) throw new Error('too many $filter options specified');
      opts.filter = condenseBoolCommonExpr(selectedAlternative.descriptors().expression.singleItem());
    }
    else throw new Error('unsupported systemQueryOption');
  }
  return opts;
}

function condenseBoolCommonExpr(boolCommonExpr) {
  var andOrGroup = boolCommonExpr.nthItem(1);
  
  var leftHandSide, operatorAndRightHandSide;
  
  var selectedAlternative;
  if(selectedAlternative = boolCommonExpr.descriptors().commonExpr) {
    leftHandSide = condenseCommonExpr(selectedAlternative.singleItem());
    if(boolCommonExpr.descriptors().commonExprOperators) {
      var opExpr = boolCommonExpr.descriptors().commonExprOperators;
      operatorAndRightHandSide = condenseOperatorExpr(opExpr, opExpr.alternativeName());
    }
  }
  else throw new Error('unsupported bool common expression ' + Object.keys(boolCommonExpr.descriptors()));
  
  var lhsReturnValue;
  if(operatorAndRightHandSide) lhsReturnValue = { type: 'operator', lhs: leftHandSide, rhs: operatorAndRightHandSide.rhs, op: operatorAndRightHandSide.op };
  else lhsReturnValue = leftHandSide;
  
  //and/or
  var andOrExpr = boolCommonExpr.descriptors().andOrExpr;
  if(andOrExpr) {
    var rhsBoolCommonExpr = andOrExpr.descriptors().rhsExpr.singleItem();
    var rhsReturnValue = condenseBoolCommonExpr(rhsBoolCommonExpr);
    return { type: 'operator', lhs: lhsReturnValue, rhs: rhsReturnValue, op: andOrExpr.alternativeName() };
  }
  else return lhsReturnValue;
}

function condenseCommonExpr(commonExpr) {
  var selectedAlternative;
  if(selectedAlternative = commonExpr.descriptors().primitiveLiteral)
    return condensePrimitiveLiteral(selectedAlternative.singleItem());
  else if(selectedAlternative = commonExpr.descriptors().parenExpr)
    return condenseParenthesesExpr(selectedAlternative.singleItem());
  else if(selectedAlternative = commonExpr.descriptors().memberExpr)
    return condenseFirstMemberExpr(selectedAlternative.singleItem());
  else
    throw new Error('unsupported expression');
  
  //TODO second group
}

function condenseFirstMemberExpr(expr) {
  var inscopeVariable = expr.descriptors().inscopeVariable;
  var memberExpr = condenseRelativeMemberExpr(expr.descriptors().memberExpr.singleItem());
  return { type: 'member-expression', variable: inscopeVariable && inscopeVariable.str(), path: memberExpr }
}

function condenseRelativeMemberExpr(expr) {
  if(expr.descriptors().entityTypeName || expr.descriptors().boundFunction) throw new Error('unsupported member expression');
  console.log('relativeMemeberExpr: ', expr.descriptors());
  if(expr.descriptors().propertyPath) {
    var ret = {};
    var propertyPath = expr.descriptors().propertyPath.singleItem();
    if(propertyPath.descriptors().property) {
      ret.property = propertyPath.descriptors().property.str();
      if(propertyPath.descriptors().singleNavigation)
        ret.singleNavigation = condenseRelativeMemberExpr(propertyPath.descriptors().singleNavigation.descriptors().memberExpr.singleItem());
      if(propertyPath.descriptors().collectionNavigation) {
        ret.collectionNavigation = condenseCollectionNavigationExpr(propertyPath.descriptors().collectionNavigation.singleItem());
      }
      if(propertyPath.descriptors().primitivePath || propertyPath.descriptors().complexPath || propertyPath.descriptors().complexColPath || propertyPath.descriptors().collectionPath)
        throw new Error('unsupported member expression' + JSON.stringify(Object.keys(propertyPath.descriptors())));
      return ret;
    } 
  }
  throw new Error('unsupported member expression');
}

function condenseCollectionNavigationExpr(expr) {
  throw new Error('collectionNavigationExpr is unsupported');
}

function condenseOperatorExpr(operatorExpr, name) {
  var ret = {};
  ret.rhs = condenseCommonExpr(operatorExpr.descriptors().rhsExpr.singleItem());
  ret.op = name;
  return ret;
}

function condensePrimitiveLiteral(expr) {
  switch(expr.nthItemName(0)) {
    case 'decimalValue':
      return { type: 'decimalValue', value: parseInt(expr.str()) };
    case 'booleanValue':
      return { type: 'booleanValue', value: expr.str() == 'true' };
    case 'string':
      return { type: 'string', value: expr.nthItem(0).nthItem(1).str() };
    default:
      throw new Error('unsupported primitive literal');
  }
}

function condenseParenthesesExpr(expr) {
  return condenseCommonExpr(expr.descriptors().innerExpr.singleItem());
}