import mappings = require("./mappings");
import schema = require("../odata/schema");
import gpatterns = require("../sparql/graphpatterns");
import filters = require("./filters");
import propertyTrees = require("./propertytree");
import propertyTreesImpl = require("./propertytree_impl");

export class FilterGraphPatternFactory {

  /* @smell there are two kinds of PropertyTrees */
  public createFromPropertyTree(filterContext: filters.FilterContext, propertyTree: filters.ScopedPropertyTree,
                                branchFactory: propertyTrees.BranchFactory): gpatterns.TreeGraphPattern {
    let result = new gpatterns.TreeGraphPattern(filterContext.mapping.variables.getVariable());
    /* @smell pass selector as argument */
    let selector: propertyTrees.GraphPatternSelector = new propertyTreesImpl.GraphPatternSelectorForFiltering(result);
    this.createTree(filterContext, propertyTree, branchFactory).traverse({
      patternSelector: selector,
      mapping: filterContext.mapping,
    });

    return result;
  }

  public createTree(filterContext: filters.FilterContext, propertyTree: filters.ScopedPropertyTree,
                    branchFactory: propertyTrees.BranchFactory): propertyTrees.Tree {
    let entityType = filterContext.entityType;
    let scope = filterContext.lambdaVariableScope;
    let result = new propertyTrees.RootTree();

    for (let it = propertyTree.root.getIterator(); it.hasValue(); it.next()) {
      let propertyName = it.current();
      let property = entityType.getProperty(propertyName);
      this.createAndInsertBranch(property, filterContext, propertyTree.root, branchFactory)
        .copyTo(result);
    }

    for (let it = propertyTree.inScopeVariables.getIterator(); it.hasValue(); it.next()) {
      let inScopeVar = it.current();
      let lambdaExpression = scope.get(inScopeVar);
      let args: propertyTrees.BranchingArgs = {
        property: inScopeVar,
        inScopeVariable: true,
        inScopeVariableType: lambdaExpression.entityType,
      };
      let branch = result.branch(branchFactory.create(args));

      let flatTree = propertyTree.inScopeVariables.getBranch(inScopeVar);
      let subPropertyTree = filters.ScopedPropertyTree.create(flatTree);
      let subContext: filters.FilterContext = {
        entityType: lambdaExpression.entityType,
        mapping: filterContext.mapping.getSubMappingByLambdaVariable(inScopeVar, lambdaExpression.entityType),
        lambdaVariableScope: new filters.LambdaVariableScope(),
      };
      this.createTree(subContext, subPropertyTree, branchFactory)
        .copyTo(branch);
    }

    return result;
  }

  public createAnyExpressionPattern(outerFilterContext: filters.FilterContext,
                                    propertyTree: filters.ScopedPropertyTree,
                                    belongingLambdaExpression: filters.LambdaExpression,
                                    propertyPath: filters.PropertyPath,
                                    branchFactory: propertyTrees.BranchFactory) {
    let innerFilterContext = {
      mapping: outerFilterContext.mapping,
      entityType: outerFilterContext.entityType,
      lambdaVariableScope: outerFilterContext.lambdaVariableScope.clone().add(belongingLambdaExpression),
    };
    let innerTree = this.createTree(innerFilterContext, propertyTree, branchFactory);
    let ret = new gpatterns.TreeGraphPattern(outerFilterContext.mapping.variables.getVariable());
    innerTree.traverse({
      patternSelector: /* @smell */ new propertyTreesImpl.GraphPatternSelectorForFiltering(ret),
      mapping: outerFilterContext.mapping,
    });

    let pathWithoutCollectionProperty = propertyPath.getPropertyPathWithoutFinalSegments(1);

    let propertiesWithoutCollectionProperty = propertyPath.getPropertyNamesWithoutLambdaPrefix();
    let finalPropertyName = propertiesWithoutCollectionProperty[propertiesWithoutCollectionProperty.length - 1];
    let entityType = pathWithoutCollectionProperty.getFinalEntityType();
    let finalProperty = entityType.getProperty(finalPropertyName);
    let finalVariableName = outerFilterContext.mapping
      .variables.getLambdaNamespace(belongingLambdaExpression.variable).getVariable();

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

  private createAndInsertBranch(property: schema.Property,
                                filterContext: filters.FilterContext, propertyTree: filters.FlatPropertyTree,
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
    this.createTree(subContext, scopedPropertyTree, branchFactory)
      .copyTo(branch);

    return result;
  }
}
