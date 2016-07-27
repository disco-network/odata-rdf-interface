import schema = require("../odata/schema");
import gpatterns = require("../sparql/graphpatterns");
import filters = require("./filters");
import propertyTrees = require("./propertytree");
import propertyTreesImpl = require("./propertytree_impl");

export class FilterGraphPatternFactory {

  public createAnyExpressionPattern(outerFilterContext: filters.FilterContext,
                                    innerLowLevelPropertyTree: filters.ScopedPropertyTree,
                                    innerLambdaExpression: filters.LambdaExpression,
                                    propertyPathToExpr: filters.PropertyPath,
                                    branchFactory: propertyTrees.BranchFactory) {

    let propertyPathWithoutCollectionProperty = propertyPathToExpr.getPropertyPathWithoutFinalSegments(1);
    let propertyNames = propertyPathToExpr.getPropertyNamesWithoutLambdaPrefix();
    let collectionPropertyName = propertyNames[propertyNames.length - 1];
    let collectionProperty = propertyPathWithoutCollectionProperty.getFinalEntityType()
      .getProperty(collectionPropertyName);

    let tree = new propertyTrees.RootTree();
    let branch = tree.branch(branchFactory.create({
      type: "any",
      name: collectionPropertyName,
      lambdaExpression: innerLambdaExpression,
      inverse: !collectionProperty.hasDirectRdfRepresentation(),
    }));

    let innerFilterContext: filters.FilterContext = {
      mapping: null,
      scopedMapping: null,
      entityType: outerFilterContext.entityType,
      unscopedEntityType: outerFilterContext.unscopedEntityType,
      lambdaVariableScope: outerFilterContext.lambdaVariableScope.clone().add(innerLambdaExpression),
    };
    let innerMapping = propertyPathWithoutCollectionProperty.getFinalMapping();
    let innerTree = this.createPropertyTree(innerFilterContext, innerLowLevelPropertyTree, branchFactory);
    innerTree.copyTo(branch);

    let ret = new gpatterns.TreeGraphPattern(innerMapping.variables.getVariable());
    tree.traverse({
      patternSelector: /* @smell */ new propertyTreesImpl.GraphPatternSelector(ret),
      mapping: innerMapping,
      scopedMapping: outerFilterContext.scopedMapping,
    });

    return ret;
  }

  /* @smell there are two kinds of PropertyTrees */
  public createPattern(filterContext: filters.FilterContext, propertyTree: filters.ScopedPropertyTree,
                       branchFactory: propertyTrees.BranchFactory): gpatterns.TreeGraphPattern {
    let result = new gpatterns.TreeGraphPattern(filterContext.mapping.variables.getVariable());
    /* @smell pass selector as argument */
    let selector: propertyTrees.GraphPatternSelector = new propertyTreesImpl.GraphPatternSelector(result);
    this.createPropertyTree(filterContext, propertyTree, branchFactory).traverse({
      patternSelector: selector,
      mapping: filterContext.mapping,
      scopedMapping: filterContext.scopedMapping,
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
        type: "inScopeVariable",
        name: inScopeVar,
        inScopeVariableType: lambdaExpression.entityType,
      };
      let branch = result.branch(branchFactory.create(args));

      let flatTree = lowLevelPropertyTree.inScopeVariables.getBranch(inScopeVar);
      let subPropertyTree = filters.ScopedPropertyTree.create(flatTree);
      let subContext: filters.FilterContext = {
        entityType: lambdaExpression.entityType,
        unscopedEntityType: filterContextOfBranch.unscopedEntityType,
        mapping: null,
        scopedMapping: null,
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
      type: "property",
      name: property.getName(),
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
      scopedMapping: /* @todo */ null,
      entityType: property.getEntityType(),
      unscopedEntityType: /* @todo */ null,
      lambdaVariableScope: new filters.LambdaVariableScope(),
    };
    let scopedPropertyTree = filters.ScopedPropertyTree.create();
    scopedPropertyTree.root = propertyTree.getBranch(property.getName());
    this.createPropertyTree(subContext, scopedPropertyTree, branchFactory)
      .copyTo(branch);

    return result;
  }
}
