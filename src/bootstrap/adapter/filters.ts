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
import { IFilterContext, IExpressionTranslator } from "../../adapter/filtertranslators";

export interface IVisitor extends IVisitor, ILiteralVisitor, IBinaryExprVisitor,
                       IParenthesesVisitor, IPropertyVisitor {}

export class AnyExpressionTranslatorFactory implements IAnyExpressionTranslatorFactory {
  public create(propertyPath: string[], lambdaVar: ILambdaVariable, lambdaExpression: IExpressionTranslator,
                filterContext: IFilterContext) {
    return new AnyExpressionTranslator(propertyPath, lambdaVar, lambdaExpression, filterContext,
                                       getFilterGraphPatternStrategy());
  }
}

export const Visitor: ITypeofVisitor<IVisitor> = AssembledVisitor<IVisitor>(VisitorBase, [
  LiteralVisitor, BinaryExprVisitor, ParenthesesVisitor,
  generatePropertyVisitor(new AnyExpressionTranslatorFactory()),
]);

export class FilterExpressionFactory {

  private visitor: IVisitor;

  constructor() {
    const state: IVisitorState = { filterContext: null }; /* @smell */
    this.visitor = new Visitor(state);
  }

  public create(expression: IValue<IVisitor>, context: IFilterContext) {
    return this.visitor.create(expression, context);
  }
}
