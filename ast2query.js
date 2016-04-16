module.exports = { getQueryFromSyntaxTree: getQueryFromSyntaxTree };

var queries = require('./queries');
var navi = require('../abnfjs/ast-navigator');

function getQueryFromSyntaxTree(ast) {
  return getQueryFromCondensedSyntaxTree(condenseSyntaxTree(ast));
}

function getQueryFromCondensedSyntaxTree(ast) {
  try {
    switch(ast.type) {
      case 'resourceQuery':
        if(ast.resourcePath.type !== 'entitySet') throw new Error('unsupported');
        if(ast.resourcePath.navigation.qualifiedEntityTypeName != null) throw new Error('unsupported');
        if(ast.resourcePath.navigation.collectionNavPath != null) {
          if(ast.resourcePath.navigation.collectionNavPath.type !== 'keyPredicate' || ast.resourcePath.navigation.collectionNavPath.keyPredicate.type !== 'simpleKey') throw new Error('unsupported');
          return new queries.GetSingleEntityQuery({ entitySet: ast.resourcePath.entitySetName, key: ast.resourcePath.navigation.collectionNavPath.keyPredicate.simpleKey });
        }
        else {
          return new queries.GetManyEntitiesQuery({ entitySet: ast.resourcePath.entitySetName });
        }
      default:
        throw new Error('unsupported');
    }
  }
  catch(e) {
    return new queries.UnsupportedQuery(e.message);
  }
}

function condenseSyntaxTree(ast) {
  ast = navi(ast);
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
  var navigation = condenseNavigation(descriptors.navigation && descriptors.navigation.singleItem());
  return { type: 'entitySet', entitySetName: entitySetName.str(), navigation: navigation };
}

function condenseNavigation(navigationExpr) {
  if(navigationExpr) return condenseCollectionNavigation(navigationExpr);
  else return null;
}

function condenseCollectionNavigation(collectionNavigation) {
  var descriptors = collectionNavigation.descriptors();
  var qualifiedEntityTypeName = descriptors.qualifiedEntityTypeName;
  var collectionNavPath = descriptors.collectionNavPath;
  
  var ret = {};
  if(qualifiedEntityTypeName) {
    var qualifiedEntityTypeNameExpression = qualifiedEntityTypeName.singleItem();
    ret.qualifiedEntityTypeName = {};
    ret.qualifiedEntityTypeName.namespace = qualifiedEntityTypeNameExpression.nthItem(0).str();
    ret.qualifiedEntityTypeName.entityTypeName = qualifiedEntityTypeNameExpression.nthItem(2).str();
  }
  if(collectionNavPath) {
    var collectionNavPathExpression = collectionNavPath.singleItem();
    var descriptors = collectionNavPathExpression.descriptors();
    ret.collectionNavPath = {};
    if(descriptors.keyPredicate) {
      ret.collectionNavPath.type = 'keyPredicate';
      ret.collectionNavPath.keyPredicate = {};
      var keyPredicateExpr = descriptors.keyPredicate.singleItem();
      var keyPredicateDescriptors = keyPredicateExpr.descriptors();
      if(keyPredicateDescriptors.simpleKey) {
        var simpleKey = keyPredicateDescriptors.simpleKey.singleItem().descriptors().value.str();
        ret.collectionNavPath.keyPredicate.type = 'simpleKey';
        ret.collectionNavPath.keyPredicate.simpleKey = parseInt(simpleKey); 
        //TODO: key type!!!
      }
      else throw new Error('unsupported');
    }
    else throw new Error('unsupported: collectionNavPath');
  }
  return ret;
}

function condenseQueryOptions(expr) {
  if(!expr) return;
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
  console.log(opts.filter); //TODO
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
  else
    throw new Error('unsupported expression');
  
  //TODO second group
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