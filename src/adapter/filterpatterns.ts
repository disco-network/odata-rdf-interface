import schema = require("../odata/schema");
import { ILambdaVariable, IScope, LambdaVariableScope } from "../odata/filters";
import { ScopedPropertyTree, FlatPropertyTree } from "../odata/filtertree";
import gpatterns = require("../sparql/graphpatterns");
import translators = require("./filtertranslators");
import { IBranchFactory, Tree } from "./propertytree/propertytree";
import propertyTreesImpl = require("./propertytree/propertytree_impl");
import { TraversingArgs, IGraphPatternSelector } from "./propertytree/traversingargs";
import {
  IBranchingArgs, InScopeVariableBranchingArgs, AnyBranchingArgs, PropertyBranchingArgsFactory,
} from "./propertytree/branchingargs";

export class FilterGraphPatternStrategy {

  constructor(private branchFactory: IBranchFactory<IBranchingArgs>) {}

  public createAnyExpressionPattern(outerFilterContext: translators.IFilterContext,
                                    innerLowLevelPropertyTree: ScopedPropertyTree,
                                    lambdaVariable: ILambdaVariable,
                                    propertyPathToExpr: translators.PropertyPath) {

    let propertyPathWithoutCollectionProperty = propertyPathToExpr.getPropertyPathWithoutFinalSegments(1);
    let propertyNames = propertyPathToExpr.getPropertyNamesWithoutLambdaPrefix();
    let collectionPropertyName = propertyNames[propertyNames.length - 1];
    let collectionProperty = propertyPathWithoutCollectionProperty.getFinalEntityType()
      .getProperty(collectionPropertyName);

    let tree = new Tree();
    let branch = tree.branchNode(this.branchFactory.create(
      new AnyBranchingArgs(collectionPropertyName, lambdaVariable, !collectionProperty.hasDirectRdfRepresentation())));

    let innerFilterContext: IScope = {
      entityType: outerFilterContext.scope.entityType,
      lambdaVariableScope: outerFilterContext.scope.lambdaVariableScope.clone().add(lambdaVariable),
    };
    let innerMapping = propertyPathWithoutCollectionProperty.getFinalMapping();
    let innerTree = this.createPropertyTree(innerFilterContext, innerLowLevelPropertyTree);
    innerTree.copyTo(branch);

    let ret = new gpatterns.TreeGraphPattern(innerMapping.variables.getVariable());
    tree.traverse(new TraversingArgs({
      patternSelector: /* @smell */ new propertyTreesImpl.GraphPatternSelector(ret),
      mapping: innerMapping,
      scopedMapping: outerFilterContext.mapping.scope,
    }));

    return ret;
  }

  /* @smell there are two kinds of PropertyTrees */
  public createPattern(filterContext: translators.IFilterContext,
                       propertyTree: ScopedPropertyTree): gpatterns.TreeGraphPattern {
    let result = new gpatterns.TreeGraphPattern(filterContext.mapping.scope.unscoped().variables.getVariable());
    /* @smell pass selector as argument */
    let selector: IGraphPatternSelector = new propertyTreesImpl.GraphPatternSelector(result);
    this.createPropertyTree(filterContext.scope, propertyTree).traverse(new TraversingArgs({
      patternSelector: selector,
      mapping: filterContext.mapping.scope.unscoped(),
      scopedMapping: filterContext.mapping.scope,
    }));

    return result;
  }

  public createPropertyTree(filterContext: IScope,
                            lowLevelPropertyTree: ScopedPropertyTree): Tree {
    return this.createPropertyBranch(filterContext, filterContext.entityType, lowLevelPropertyTree);
  }

  private createPropertyBranch(scopeContext: IScope,
                               unscopedEntityType: schema.EntityType,
                               lowLevelPropertyTree: ScopedPropertyTree) {
    let entityType = scopeContext.entityType;
    let variableScope = scopeContext.lambdaVariableScope;
    let result = new Tree();

    for (let it = lowLevelPropertyTree.root.getIterator(); it.hasValue(); it.next()) {
      let propertyName = it.current();
      let property = entityType.getProperty(propertyName);
      this.createAndInsertBranch(property, lowLevelPropertyTree.root)
        .copyTo(result);
    }

    for (let it = lowLevelPropertyTree.inScopeVariables.getIterator(); it.hasValue(); it.next()) {
      let inScopeVar = it.current();
      let lambdaExpression = variableScope.get(inScopeVar);
      let args = new InScopeVariableBranchingArgs(inScopeVar, lambdaExpression.entityType);
      let branch = result.branchNode(this.branchFactory.create(args));

      let flatTree = lowLevelPropertyTree.inScopeVariables.getBranch(inScopeVar);
      let subPropertyTree = ScopedPropertyTree.create(flatTree);
      let subContext: IScope = {
        entityType: lambdaExpression.entityType,
        lambdaVariableScope: new LambdaVariableScope(),
      };
      this.createPropertyBranch(subContext, unscopedEntityType, subPropertyTree)
        .copyTo(branch);
    }

    return result;
  }

  private createAndInsertBranch(property: schema.Property,
                                propertyTree: FlatPropertyTree): Tree {
    let args = (new PropertyBranchingArgsFactory()).fromProperty(property);

    let result = new Tree();
    let branch = result.branchNode(this.branchFactory.create(args));

    let subContext: IScope = {
      entityType: property.getEntityType(),
      lambdaVariableScope: new LambdaVariableScope(),
    };
    let scopedPropertyTree = ScopedPropertyTree.create();
    scopedPropertyTree.root = propertyTree.getBranch(property.getName());
    this.createPropertyTree(subContext, scopedPropertyTree)
      .copyTo(branch);

    return result;
  }
}
