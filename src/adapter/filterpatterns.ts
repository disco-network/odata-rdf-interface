import mappings = require("./mappings");
import gpatternInsertions = require("./graphpatterninsertions");
import schema = require("../odata/schema");
import gpatterns = require("../odata/graphpatterns");

export interface QueryContext {
  mapping: mappings.StructuredSparqlVariableMapping;
  entityType: schema.EntityType;
  lambdaExpressions: LambdaExpression[];
}

export interface LambdaExpression {
  variable: string;
}

export class FilterGraphPatternFactory {

  public static create(queryContext: QueryContext, propertyTree: any) {
    let mapping = queryContext.mapping;
    let entityType = queryContext.entityType;
    let result = new gpatterns.TreeGraphPattern(mapping.getVariable());

    Object.keys(propertyTree).forEach(propertyName => {
      let property = entityType.getProperty(propertyName);
      switch (property.getEntityKind()) {
        case schema.EntityKind.Elementary:
          new gpatternInsertions.ElementaryBranchInsertionBuilderForFiltering()
            .setElementaryProperty(property)
            .setMapping(mapping)
            .buildCommand()
            .applyTo(result);
          break;
        case schema.EntityKind.Complex:
          if (!property.isCardinalityOne()) throw new Error("Properties of higher cardinality are not allowed.");
          let subQueryContext: QueryContext = {
            mapping: mapping.getComplexProperty(propertyName),
            entityType: property.getEntityType(),
            lambdaExpressions: [],
          };
          let branchedPattern = FilterGraphPatternFactory.create(subQueryContext,
            propertyTree[propertyName]);
          new gpatternInsertions.ComplexBranchInsertionBuilderForFiltering()
            .setComplexProperty(property)
            .setMapping(mapping)
            .setValue(branchedPattern)
            .buildCommand()
            .applyTo(result);
          break;
        default:
          throw new Error("invalid entity kind " + property.getEntityKind());
      }
    });

    return result;
  }
}
