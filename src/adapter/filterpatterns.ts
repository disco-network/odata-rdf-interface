import schema = require("../odata/schema");
import gpatterns = require("../sparql/graphpatterns");
import filters = require("./filters");
import propertyTrees = require("./propertytree");
import propertyTreesImpl = require("./propertytree_impl");

export class FilterGraphPatternFactory {

  public createAnyExpressionPattern(outerFilterContext: filters.FilterContext,
                                    lowLevelPropertyTree: filters.ScopedPropertyTree,
                                    innerLambdaExpression: filters.LambdaExpression,
                                    propertyPathToExpr: filters.PropertyPath,
                                    branchFactory: propertyTrees.BranchFactory) {
    let innerFilterContext = {
      mapping: outerFilterContext.mapping,
      entityType: outerFilterContext.entityType,
      lambdaVariableScope: outerFilterContext.lambdaVariableScope.clone().add(innerLambdaExpression),
    };
    let innerTree = this.createPropertyTree(innerFilterContext, lowLevelPropertyTree, branchFactory);
    let ret = new gpatterns.TreeGraphPattern(outerFilterContext.mapping.variables.getVariable());
    innerTree.traverse({
      patternSelector: /* @smell */ new propertyTreesImpl.GraphPatternSelectorForFiltering(ret),
      mapping: outerFilterContext.mapping,
    });

    let pathWithoutCollectionProperty = propertyPathToExpr.getPropertyPathWithoutFinalSegments(1);

    let propertiesWithoutCollectionProperty = propertyPathToExpr.getPropertyNamesWithoutLambdaPrefix();
    let finalPropertyName = propertiesWithoutCollectionProperty[propertiesWithoutCollectionProperty.length - 1];
    let entityType = pathWithoutCollectionProperty.getFinalEntityType();
    let finalProperty = entityType.getProperty(finalPropertyName);
    let finalVariableName = outerFilterContext.mapping
      .variables.getLambdaNamespace(innerLambdaExpression.variable).getVariable();

    /* @smell */
    if (finalProperty.hasDirectRdfRepresentation()) {
      ret
        .looseBranch(pathWithoutCollectionProperty.getFinalMapping().variables.getVariable())
        .optionalBranch(finalProperty.getNamespacedUri(), finalVariableName);
    }
    else {
      ret
        .looseBranch(pathWithoutCollectionProperty.getFinalMapping().variables.getVariable())
        .optionalInverseBranch(finalProperty.getInverseProperty().getNamespacedUri(), finalVariableName);
    }

    return ret;
  }

  /* @smell there are two kinds of PropertyTrees */
  public create(filterContext: filters.FilterContext, propertyTree: filters.ScopedPropertyTree,
                branchFactory: propertyTrees.BranchFactory): gpatterns.TreeGraphPattern {
    let result = new gpatterns.TreeGraphPattern(filterContext.mapping.variables.getVariable());
    /* @smell pass selector as argument */
    let selector: propertyTrees.GraphPatternSelector = new propertyTreesImpl.GraphPatternSelectorForFiltering(result);
    this.createPropertyTree(filterContext, propertyTree, branchFactory).traverse({
      patternSelector: selector,
      mapping: filterContext.mapping,
    });

    return result;
  }

  public createPropertyTree(filterContext: filters.FilterContext, lowLevelPropertyTree: filters.ScopedPropertyTree,
                            branchFactory: propertyTrees.BranchFactory): propertyTrees.Tree {
    return this.createPropertyBranch(filterContext, filterContext, lowLevelPropertyTree, branchFactory);
  }

  private createPropertyBranch(filterContextOfRoot: filters.FilterContext, filterContextOfBranch: filters.FilterContext,
                               lowLevelPropertyTree: filters.ScopedPropertyTree,
                               branchFactory: propertyTrees.BranchFactory) {
    let entityType = filterContextOfBranch.entityType;
    let scope = filterContextOfBranch.lambdaVariableScope;
    let result = new propertyTrees.RootTree();

    for (let it = lowLevelPropertyTree.root.getIterator(); it.hasValue(); it.next()) {
      let propertyName = it.current();
      let property = entityType.getProperty(propertyName);
      this.createAndInsertBranch(property, lowLevelPropertyTree.root, branchFactory)
        .copyTo(result);
    }

    for (let it = lowLevelPropertyTree.inScopeVariables.getIterator(); it.hasValue(); it.next()) {
      let inScopeVar = it.current();
      let lambdaExpression = scope.get(inScopeVar);
      let args: propertyTrees.BranchingArgs = {
        property: inScopeVar,
        inScopeVariable: true,
        inScopeVariableType: lambdaExpression.entityType,
      };
      let branch = result.branch(branchFactory.create(args));

      let flatTree = lowLevelPropertyTree.inScopeVariables.getBranch(inScopeVar);
      let subPropertyTree = filters.ScopedPropertyTree.create(flatTree);
      let subContext: filters.FilterContext = {
        entityType: lambdaExpression.entityType,
        mapping: filterContextOfBranch.mapping.getSubMappingByLambdaVariable(inScopeVar, lambdaExpression.entityType),
        lambdaVariableScope: new filters.LambdaVariableScope(),
      };
      this.createPropertyBranch(filterContextOfRoot, subContext, subPropertyTree, branchFactory)
        .copyTo(branch);
    }

    return result;
  }

  private createAndInsertBranch(property: schema.Property, propertyTree: filters.FlatPropertyTree,
                                branchFactory: propertyTrees.BranchFactory): propertyTrees.Tree {
    let args: propertyTrees.BranchingArgs = {
      property: property.getName(),
      inScopeVariable: false,
      complex: property.getEntityKind() === schema.EntityKind.Complex,
      singleValued: property.isCardinalityOne(),
      inverse: !property.mirroredFromProperty() && !property.hasDirectRdfRepresentation(),
      mandatory: !property.isOptional(),
      mirroredIdFrom: property.mirroredFromProperty() && property.mirroredFromProperty().getName(),
    };

    let result = new propertyTrees.RootTree();
    let branch = result.branch(branchFactory.create(args));

    let subContext: filters.FilterContext = {
      mapping: null,
      entityType: property.getEntityType(),
      lambdaVariableScope: new filters.LambdaVariableScope(),
    };
    let scopedPropertyTree = filters.ScopedPropertyTree.create();
    scopedPropertyTree.root = propertyTree.getBranch(property.getName());
    this.createPropertyTree(subContext, scopedPropertyTree, branchFactory)
      .copyTo(branch);

    return result;
  }
}
