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
      /*result.newConjunctivePattern(this.createFromPropertyTree(subContext, subPropertyTree));*/
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

    /*let args: propertyTrees.BranchingArgs = {
      property: finalPropertyName,
      environment: /* @smell * propertyTrees.BranchingEnvironment.Expand,
      inScopeVariable: false,
      complex: true,
      inverse: !finalProperty.hasDirectRdfRepresentation(),
      singleValued: false,
      mirroredIdFrom: undefined,
      mandatory: false,
    };
    let tree = branchFactory.create(args);
    tree.traverse({
      patternSelector: /* @smell * new propertyTreesImpl.GraphPatternSelectorForFiltering(ret),
      mapping: pathWithoutCollectionProperty.getFinalMapping(),
    });*/

    return ret;

    /*let conjunctivePattern: gpatterns.TreeGraphPattern;
    let currentPropertyType = propertyPath.getEntityTypeAfterLambdaPrefix();
    let currentMapping = propertyPath.getMappingAfterLambdaPrefix();
    if (propertyPath.getPrefixLambdaExpression() === undefined) {
      conjunctivePattern = ret.newConjunctivePattern();
    }
    else {
      // adopt the root variable of the lambda expression
      conjunctivePattern = ret.newConjunctivePattern(
        new gpatterns.TreeGraphPattern(outerFilterContext.mapping.variables.getLambdaNamespace(
          propertyPath.getPrefixLambdaExpression().variable
        ).getVariable()));
    }
    // create a branch path to the property
    let branchingContext = {
      mapping: currentMapping,
      entityType: currentPropertyType,
      pattern: conjunctivePattern,
    };

    let allPropertyNames = propertyPath.getPropertyNamesWithoutLambdaPrefix();
    let propertiesExceptLast = allPropertyNames.slice(0, -1);
    let lastPropertyName = allPropertyNames[allPropertyNames.length - 1];
    branchingContext = this.branchAlongPropertyChain(branchingContext, propertiesExceptLast);
    this.singleBranch(branchingContext, lastPropertyName, new gpatterns.TreeGraphPattern(
      branchingContext.mapping.variables.getLambdaNamespace(belongingLambdaExpression.variable).getVariable()));

    return ret;*/
  }

  /*private branchAlongPropertyChain(baseBranchingContext: BranchingContext,
                                          propertyChain: string[]): BranchingContext {
    let branchingContext = baseBranchingContext;
    for (let i = 0; i < propertyChain.length; ++i) {
      let value = new gpatterns.TreeGraphPattern(
        branchingContext.mapping.variables.getComplexProperty(propertyChain[i]).getVariable());
      branchingContext = this.singleBranch(branchingContext, propertyChain[i], value);
    }
    return branchingContext;
  }*/

  /*private singleBranch(context: BranchingContext, property: string, value: gpatterns.TreeGraphPattern
                             ): BranchingContext {
    let result = value;
    new gpatternInsertions.ComplexBranchInsertionBuilderForFiltering()
      .setMapping(context.mapping)
      .setComplexProperty(property)
      .setValue(result)
      .buildCommand()
      .applyTo(context.pattern);
    return {
      mapping: context.mapping.getSubMappingByComplexProperty(property),
      entityType: context.entityType.getProperty(property).getEntityType(),
      pattern: result,
    };
  }*/

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

    /*switch (property.getEntityKind()) {
      case schema.EntityKind.Elementary:
        new gpatternInsertions.ElementaryBranchInsertionBuilderForFiltering()
          .setElementaryProperty(property)
          .setMapping(mapping)
          .buildCommand()
          .applyTo(pattern);
        break;
      case schema.EntityKind.Complex:
        if (!property.isCardinalityOne()) throw new Error("Properties of higher cardinality are not allowed.");
        let subQueryContext: filters.FilterContext = {
          mapping: mapping.getSubMappingByComplexProperty(property.getName()),
          entityType: property.getEntityType(),
          lambdaVariableScope: new filters.LambdaVariableScope(),
        };
        let scopedPropertyTree = filters.ScopedPropertyTree.create();
        scopedPropertyTree.root = propertyTree.getBranch(property.getName());
        let branchedPattern = this.createFromPropertyTree(subQueryContext, scopedPropertyTree);
        new gpatternInsertions.ComplexBranchInsertionBuilderForFiltering()
          .setComplexProperty(property.getName())
          .setMapping(mapping)
          .setValue(branchedPattern)
          .buildCommand()
          .applyTo(pattern);
        break;
      default:
        throw new Error("invalid entity kind " + property.getEntityKind());
    }*/
  }
}

/*interface BranchingContext {
  pattern: gpatterns.TreeGraphPattern;
  mapping: mappings.Mapping;
  entityType: schema.EntityType;
}*/
