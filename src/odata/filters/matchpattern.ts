import {
  IValue,
  IEqExpressionVisitor, IAndExpressionVisitor, IStringLiteralVisitor, INumericLiteralVisitor,
  INullVisitor, IPropertyValueVisitor,
} from "./expressions";

import {
  EqExpression, StringLiteral, NumericLiteral, Null, PropertyValue, AndExpression,
} from "../parser";

import {
  EdmLiteral,
} from "../edm";

import { shouldNotBeReached } from "../../controlflow";

import { EntityType } from "../schema";

export class FilterFromPatternProducer {

  public produceFromPattern(pattern: IMatchPattern, entityType: EntityType) {

    return pattern.reduce((prevFilterExpr, propertyPattern) => {
      const property = entityType.getProperty(propertyPattern.property);
      if (property === undefined) throw new Error(`Cannot find property ${propertyPattern.property}`);

      if (prevFilterExpr === null) {
        return this.producePartialExpression(propertyPattern);
      }
      else {
        return this.appendAnd(prevFilterExpr, propertyPattern);
      }
    }, null as IAllowedExpression | null) || this.produceTrue();
  }

  private produceTrue(): IAllowedExpression {
    throw new Error("not implemented");
  }

  private appendAnd(prevFilterExpr: IAllowedExpression, propertyPattern: IPropertyPattern): IAllowedExpression {
    return new AndExpression(prevFilterExpr, this.producePartialExpression(propertyPattern));
  }

  private producePartialExpression(propertyPattern: IPropertyPattern) {
    return new EqExpression(
      this.producePropertyExpression(propertyPattern.property),
      this.produceValueLiteral(propertyPattern.value));
  }

  private producePropertyExpression(name: string): IAllowedExpression {
    return new PropertyValue([ name ]);
  }

  private produceValueLiteral(literal: EdmLiteral): IAllowedExpression {
    switch (literal.type) {
      case "Edm.String":
      case "Edm.Guid":
        return new StringLiteral(literal.value);
      case "Edm.Int32":
        return new NumericLiteral(literal.value);
      case "null":
        throw new Null();
      default:
        return shouldNotBeReached(literal, `Unexpected literal type ${literal!.type}`);
    }
  }
}

export interface IPropertyPattern {
  property: string;
  value: EdmLiteral;
}

export interface IMatchPattern extends ReadonlyArray<IPropertyPattern> {}

export interface IAllowedExpression extends IValue<IMinimalVisitor> {}

export interface IMinimalVisitor extends IEqExpressionVisitor, IStringLiteralVisitor, INumericLiteralVisitor,
                                         INullVisitor, IPropertyValueVisitor, IAndExpressionVisitor {}
