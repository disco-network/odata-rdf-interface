import { getFilterGraphPatternStrategy } from "./propertytree";

import { IValue, INotExpressionVisitor } from "../../odata/filters/expressions";
import { ILambdaVariable } from "../../odata/filters/filters";

import {
  IVisitor, VisitorBase, AssembledVisitor, ITypeofVisitor,
  ILiteralVisitor, IBinaryExprVisitor, IParenthesesVisitor, IPropertyVisitor,
  LiteralVisitor, BinaryExprVisitor, ParenthesesVisitor, generatePropertyVisitor,
} from "../../adapter/filtertranslators";
import {
  AnyExpressionTranslator, IAnyExpressionTranslatorFactory,
} from "../../adapter/filters/propertyexpression";
import {
  IFilterContext, IExpressionTranslator, IEqualsUriExpressionVisitor, EqualsUriExpressionVisitor,
  IExpressionTranslatorFactory,
} from "../../adapter/filtertranslators";

export class AnyExpressionTranslatorFactory implements IAnyExpressionTranslatorFactory {
  public create(propertyPath: string[], lambdaVar: ILambdaVariable, lambdaExpression: IExpressionTranslator,
                filterContext: IFilterContext) {
    return new AnyExpressionTranslator(propertyPath, lambdaVar, lambdaExpression, filterContext,
                                       getFilterGraphPatternStrategy());
  }
}

export interface IMinimalVisitor extends IVisitor, ILiteralVisitor, IBinaryExprVisitor,
  IParenthesesVisitor, IPropertyVisitor, IEqualsUriExpressionVisitor, INotExpressionVisitor {}

export const Visitor: ITypeofVisitor<IMinimalVisitor> = AssembledVisitor<IMinimalVisitor>(VisitorBase, [
  LiteralVisitor, BinaryExprVisitor, ParenthesesVisitor, EqualsUriExpressionVisitor,
  generatePropertyVisitor(new AnyExpressionTranslatorFactory()),
]);

export class FilterExpressionTranslatorFactory implements IExpressionTranslatorFactory<IMinimalVisitor> {

  private visitor?: IMinimalVisitor;

  public create(expression: IValue<IMinimalVisitor>, context: IFilterContext) {
    return this.lazyLoadVisitor(context).create(expression, context);
  }

  private lazyLoadVisitor(context: IFilterContext): IMinimalVisitor {
    return this.visitor = this.visitor || new Visitor({ filterContext: context });
  }
}
