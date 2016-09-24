import { getFilterGraphPatternStrategy } from "./propertytree";

import { IValue } from "../../odata/filters/expressions";
import { ILambdaVariable } from "../../odata/filters/filters";

import {
  IVisitor, VisitorBase, AssembledVisitor, ITypeofVisitor, IVisitorState,
  ILiteralVisitor, IBinaryExprVisitor, IParenthesesVisitor, IPropertyVisitor,
  LiteralVisitor, BinaryExprVisitor, ParenthesesVisitor, generatePropertyVisitor,
} from "../../adapter/filtertranslators";
import {
  AnyExpressionTranslator, IAnyExpressionTranslatorFactory,
} from "../../adapter/filters/propertyexpression";
import {
  IFilterContext, IExpressionTranslator, IEqualsUriExpressionVisitor, EqualsUriExpressionVisitor,
} from "../../adapter/filtertranslators";

export class AnyExpressionTranslatorFactory implements IAnyExpressionTranslatorFactory {
  public create(propertyPath: string[], lambdaVar: ILambdaVariable, lambdaExpression: IExpressionTranslator,
                filterContext: IFilterContext) {
    return new AnyExpressionTranslator(propertyPath, lambdaVar, lambdaExpression, filterContext,
                                       getFilterGraphPatternStrategy());
  }
}

export interface IVisitor extends IVisitor, ILiteralVisitor, IBinaryExprVisitor,
                       IParenthesesVisitor, IPropertyVisitor, IEqualsUriExpressionVisitor {}

export const Visitor: ITypeofVisitor<IVisitor> = AssembledVisitor<IVisitor>(VisitorBase, [
  LiteralVisitor, BinaryExprVisitor, ParenthesesVisitor, EqualsUriExpressionVisitor,
  generatePropertyVisitor(new AnyExpressionTranslatorFactory()),
]);

export class FilterExpressionFactory {

  private visitor?: IVisitor;

  public create(expression: IValue<IVisitor>, context: IFilterContext) {
    return this.lazyLoadVisitor(context).create(expression, context);
  }

  private lazyLoadVisitor(context: IFilterContext): IVisitor {
    return this.visitor = this.visitor || new Visitor({ filterContext: context });
  }
}
