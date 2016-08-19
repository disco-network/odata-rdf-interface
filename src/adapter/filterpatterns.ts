import schema = require("../odata/schema");
import { ILambdaVariable, IScope, LambdaVariableScope } from "../odata/filters";
import gpatterns = require("../sparql/graphpatterns");
import translators = require("./filtertranslators");
import { IBranchFactory, RootTree, Tree } from "./propertytree/propertytree";
import propertyTreesImpl = require("./propertytree/propertytree_impl");
import { TraversingArgs, IGraphPatternSelector } from "./propertytree/traversingargs";
import {
  IBranchingArgs, InScopeVariableBranchingArgs, AnyBranchingArgs, PropertyBranchingArgsFactory,
} from "./propertytree/branchingargs";

export class FilterGraphPatternStrategy {

  constructor(private branchFactory: IBranchFactory<IBranchingArgs>) {}

  public createAnyExpressionPattern(outerFilterContext: translators.IFilterContext,
                                    innerLowLevelPropertyTree: translators.ScopedPropertyTree,
                                    lambdaVariable: ILambdaVariable,
                                    propertyPathToExpr: translators.PropertyPath) {

    let propertyPathWithoutCollectionProperty = propertyPathToExpr.getPropertyPathWithoutFinalSegments(1);
    let propertyNames = propertyPathToExpr.getPropertyNamesWithoutLambdaPrefix();
    let collectionPropertyName = propertyNames[propertyNames.length - 1];
    let collectionProperty = propertyPathWithoutCollectionProperty.getFinalEntityType()
      .getProperty(collectionPropertyName);

    let tree = new RootTree();
    let branch = tree.branch(this.branchFactory.create(
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
      scopedMapping: outerFilterContext.mapping.scopedMapping,
    }));

    return ret;
  }

  /* @smell there are two kinds of PropertyTrees */
  public createPattern(filterContext: translators.IFilterContext,
                       propertyTree: translators.ScopedPropertyTree): gpatterns.TreeGraphPattern {
    let result = new gpatterns.TreeGraphPattern(filterContext.mapping.mapping.variables.getVariable());
    /* @smell pass selector as argument */
    let selector: IGraphPatternSelector = new propertyTreesImpl.GraphPatternSelector(result);
    this.createPropertyTree(filterContext.scope, propertyTree).traverse(new TraversingArgs({
      patternSelector: selector,
      mapping: filterContext.mapping.mapping,
      scopedMapping: filterContext.mapping.scopedMapping,
    }));

    return result;
  }

  public createPropertyTree(filterContext: IScope,
                            lowLevelPropertyTree: translators.ScopedPropertyTree): Tree {
    return this.createPropertyBranch(filterContext, filterContext.entityType, lowLevelPropertyTree);
  }

  private createPropertyBranch(filterContextOfBranch: IScope,
                               unscopedEntityType: schema.EntityType,
                               lowLevelPropertyTree: translators.ScopedPropertyTree) {
    let entityType = filterContextOfBranch.entityType;
    let scope = filterContextOfBranch.lambdaVariableScope;
    let result = new RootTree();

    for (let it = lowLevelPropertyTree.root.getIterator(); it.hasValue(); it.next()) {
      let propertyName = it.current();
      let property = entityType.getProperty(propertyName);
      this.createAndInsertBranch(property, lowLevelPropertyTree.root)
        .copyTo(result);
    }

    for (let it = lowLevelPropertyTree.inScopeVariables.getIterator(); it.hasValue(); it.next()) {
      let inScopeVar = it.current();
      let lambdaExpression = scope.get(inScopeVar);
      let args = new InScopeVariableBranchingArgs(inScopeVar, lambdaExpression.entityType);
      let branch = result.branch(this.branchFactory.create(args));

      let flatTree = lowLevelPropertyTree.inScopeVariables.getBranch(inScopeVar);
      let subPropertyTree = translators.ScopedPropertyTree.create(flatTree);
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
                                propertyTree: translators.FlatPropertyTree): Tree {
    let args = (new PropertyBranchingArgsFactory()).fromProperty(property);

    let result = new RootTree();
    let branch = result.branch(this.branchFactory.create(args));

    let subContext: IScope = {
      entityType: property.getEntityType(),
      lambdaVariableScope: new LambdaVariableScope(),
    };
    let scopedPropertyTree = translators.ScopedPropertyTree.create();
    scopedPropertyTree.root = propertyTree.getBranch(property.getName());
    this.createPropertyTree(subContext, scopedPropertyTree)
      .copyTo(branch);

    return result;
  }
}
