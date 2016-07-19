import mappings = require("./mappings");
import gpatternInsertions = require("./graphpatterninsertions");
import schema = require("../odata/schema");
import gpatterns = require("../odata/graphpatterns");
import filters = require("./filters");

export class FilterGraphPatternFactory {

  public static create(filterContext: filters.FilterContext, propertyTree: any): gpatterns.TreeGraphPattern {
    let mapping = filterContext.mapping;
    let entityType = filterContext.entityType;
    let result = new gpatterns.TreeGraphPattern(mapping.getVariable());

    Object.keys(propertyTree).forEach(propertyName => {
      if (filterContext.lambdaExpressions[propertyName] === undefined) {
        let property = entityType.getProperty(propertyName);
        this.createAndInsertBranch(result, property, filterContext, propertyTree);
      }
      else {
        let lambdaExpression = filterContext.lambdaExpressions[propertyName];
        let subMapping = mapping.getLambdaNamespace(propertyName);
        let subPropertyTree = propertyTree[propertyName];
        let subEntityType = lambdaExpression.entityType;
        let subContext: filters.FilterContext = {
          entityType: subEntityType,
          mapping: subMapping,
          lambdaExpressions: {},
        };
        result.newConjunctivePattern(this.create(subContext, subPropertyTree));
      }
    });

    return result;
  }

  public static createAnyExpressionPattern(filterContext: filters.FilterContext, propertyTree: any,
                                           lambdaExpression: filters.LambdaExpression, pathToAny: string[]) {
    let ret = this.create(filterContext, propertyTree);

    if (pathToAny.length === 0) throw new Error("pathToAny is empty");

    let conjunctivePattern: gpatterns.TreeGraphPattern;
    let currentPropertyType: schema.EntityType;
    let currentMapping: mappings.StructuredSparqlVariableMapping;
    let nextPropertyIndex: number;
    if (pathToAny.length === 1 || filterContext.lambdaExpressions[pathToAny[0]] === undefined) {
      conjunctivePattern = ret.newConjunctivePattern();
      currentPropertyType = filterContext.entityType;
      currentMapping = filterContext.mapping;
      nextPropertyIndex = 0;
    }
    else {
      let firstPropertyInPath = pathToAny[0];
      nextPropertyIndex = 1;
      // adopt the root variable of the lambda expression
      conjunctivePattern = ret.newConjunctivePattern(
        new gpatterns.TreeGraphPattern(filterContext.mapping.getLambdaNamespace(firstPropertyInPath).getVariable()));
      currentPropertyType = filterContext.lambdaExpressions[firstPropertyInPath].entityType;
      currentMapping = filterContext.mapping.getLambdaNamespace(firstPropertyInPath);
    }
    // create a branch path to the property
    let branchingContext = {
      mapping: currentMapping,
      entityType: currentPropertyType,
      pattern: conjunctivePattern,
    };
    branchingContext = this.branchAlongPropertyChain(branchingContext, pathToAny.slice(nextPropertyIndex, -1));
    let lastPropertyName = pathToAny[pathToAny.length - 1];
    this.singleBranch(branchingContext, lastPropertyName,
      new gpatterns.TreeGraphPattern(branchingContext.mapping.getLambdaNamespace(lambdaExpression.variable).getVariable()));

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
                                       filterContext: filters.FilterContext, propertyTree: any) {
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
          lambdaExpressions: {},
        };
        let branchedPattern = this.create(subQueryContext,
          propertyTree[property.getName()]);
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
