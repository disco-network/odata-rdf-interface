import mappings = require("./mappings");
import gpatternInsertions = require("./graphpatterninsertions");
import schema = require("../odata/schema");
import gpatterns = require("../odata/graphpatterns");
import filters = require("./filters");

export interface FilterContext {
  mapping: mappings.StructuredSparqlVariableMapping;
  entityType: schema.EntityType;
  lambdaExpressions: { [id: string]: LambdaExpression };
}

export interface LambdaExpression {
  variable: string;
  expression?: filters.FilterExpression;
  entityType: schema.EntityType;
}

export class FilterGraphPatternFactory {

  public static create(filterContext: FilterContext, propertyTree: any): gpatterns.TreeGraphPattern {
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
        let subContext: FilterContext = {
          entityType: subEntityType,
          mapping: subMapping,
          lambdaExpressions: {},
        };
        result.newConjunctivePattern(this.create(subContext, subPropertyTree));
      }
    });

    return result;
  }

  private static createAndInsertBranch(pattern: gpatterns.TreeGraphPattern, property: schema.Property,
                                       filterContext: FilterContext, propertyTree: any) {
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
        let subQueryContext: FilterContext = {
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
