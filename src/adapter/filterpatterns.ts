import mappings = require("./mappings");
import gpatternInsertions = require("./graphpatterninsertions");
import schema = require("../odata/schema");
import gpatterns = require("../odata/graphpatterns");
import filters = require("./filters");

export class FilterGraphPatternFactory {

  public static createFromPropertyTree(filterContext: filters.FilterContext, propertyTree: filters.ScopedPropertyTree
                                      ): gpatterns.TreeGraphPattern {
    let mapping = filterContext.mapping;
    let entityType = filterContext.entityType;
    let result = new gpatterns.TreeGraphPattern(mapping.getVariable());

    for (let it = propertyTree.root.getIterator(); it.hasValue(); it.next()) {
      let propertyName = it.current();
      let property = entityType.getProperty(propertyName);
      this.createAndInsertBranch(result, property, filterContext, propertyTree.root);
    }

    for (let it = propertyTree.inScopeVariables.getIterator(); it.hasValue(); it.next()) {
      let inScopeVar = it.current();
      let lambdaExpression = filterContext.lambdaVariableScope.get(inScopeVar);
      let flatTree = propertyTree.inScopeVariables.getBranch(inScopeVar);
      let subPropertyTree = filters.ScopedPropertyTree.create(flatTree);
      let subContext: filters.FilterContext = {
        entityType: lambdaExpression.entityType,
        mapping: mapping.getLambdaNamespace(inScopeVar),
        lambdaVariableScope: new filters.LambdaVariableScope(),
      };
      result.newConjunctivePattern(this.createFromPropertyTree(subContext, subPropertyTree));
    }

    return result;
  }

  public static createAnyExpressionPattern(outerFilterContext: filters.FilterContext,
                                           propertyTree: filters.ScopedPropertyTree,
                                           belongingLambdaExpression: filters.LambdaExpression,
                                           propertyPath: filters.PropertyPath) {
    let innerFilterContext = {
      mapping: outerFilterContext.mapping,
      entityType: outerFilterContext.entityType,
      lambdaVariableScope: outerFilterContext.lambdaVariableScope.clone().add(belongingLambdaExpression),
    };
    let ret = this.createFromPropertyTree(innerFilterContext, propertyTree);

    let conjunctivePattern: gpatterns.TreeGraphPattern;
    let currentPropertyType = propertyPath.getEntityTypeAfterLambdaPrefix();
    let currentMapping = propertyPath.getMappingAfterLambdaPrefix();
    if (propertyPath.getPrefixLambdaExpression() === undefined) {
      conjunctivePattern = ret.newConjunctivePattern();
    }
    else {
      // adopt the root variable of the lambda expression
      conjunctivePattern = ret.newConjunctivePattern(
        new gpatterns.TreeGraphPattern(outerFilterContext.mapping.getLambdaNamespace(
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
      branchingContext.mapping.getLambdaNamespace(belongingLambdaExpression.variable).getVariable()));

    return ret;
  }

  private static branchAlongPropertyChain(baseBranchingContext: BranchingContext,
                                          propertyChain: string[]): BranchingContext {
    let branchingContext = baseBranchingContext;
    for (let i = 0; i < propertyChain.length; ++i) {
      let value = new gpatterns.TreeGraphPattern(
        branchingContext.mapping.getComplexProperty(propertyChain[i]).getVariable());
      branchingContext = this.singleBranch(branchingContext, propertyChain[i], value);
    }
    return branchingContext;
  }

  private static singleBranch(context: BranchingContext, property: string, value: gpatterns.TreeGraphPattern
                             ): BranchingContext {
    let result = value;
    new gpatternInsertions.ComplexBranchInsertionBuilderForFiltering()
      .setMapping(context.mapping)
      .setComplexProperty(context.entityType.getProperty(property))
      .setValue(result)
      .buildCommand()
      .applyTo(context.pattern);
    return {
      mapping: context.mapping.getComplexProperty(property),
      entityType: context.entityType.getProperty(property).getEntityType(),
      pattern: result,
    };
  }

  private static createAndInsertBranch(pattern: gpatterns.TreeGraphPattern, property: schema.Property,
                                       filterContext: filters.FilterContext, propertyTree: filters.FlatPropertyTree) {
    let mapping = filterContext.mapping;
    switch (property.getEntityKind()) {
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
          mapping: mapping.getComplexProperty(property.getName()),
          entityType: property.getEntityType(),
          lambdaVariableScope: new filters.LambdaVariableScope(),
        };
        let scopedPropertyTree = filters.ScopedPropertyTree.create();
        scopedPropertyTree.root = propertyTree.getBranch(property.getName());
        let branchedPattern = this.createFromPropertyTree(subQueryContext, scopedPropertyTree);
        new gpatternInsertions.ComplexBranchInsertionBuilderForFiltering()
          .setComplexProperty(property)
          .setMapping(mapping)
          .setValue(branchedPattern)
          .buildCommand()
          .applyTo(pattern);
        break;
      default:
        throw new Error("invalid entity kind " + property.getEntityKind());
    }
  }
}

interface BranchingContext {
  pattern: gpatterns.TreeGraphPattern;
  mapping: mappings.StructuredSparqlVariableMapping;
  entityType: schema.EntityType;
}
