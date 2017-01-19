export interface IValue<TVisitor> {
  accept(visitor: TVisitor): void;
}

export interface INullVisitor {
  visitNull(expr: INull<this>);
}

export interface INull<TVisitor extends INullVisitor> extends IValue<TVisitor> {
}

export interface IStringLiteralVisitor {
  visitStringLiteral(expr: IStringLiteral<this>);
}

/** @todo is it necessary to do this generically? BinaryExpression is a different case */
export interface IStringLiteral<TVisitor extends IStringLiteralVisitor> extends IValue<TVisitor> {
  getString(): string;
}

export interface INumericLiteralVisitor {
  visitNumericLiteral(expr: INumericLiteral<this>);
}
export interface INumericLiteral<TVisitor extends INumericLiteralVisitor> extends IValue<TVisitor> {
  getNumber(): number;
}

export interface IOrExpressionVisitor {
  visitOrExpression(expr: IOrExpression<this>);
}
export interface IOrExpression<TVisitor extends IOrExpressionVisitor> extends IBinaryExpression<TVisitor> {
}

export interface IAndExpressionVisitor {
  visitAndExpression(expr: IAndExpression<this>);
}
export interface IAndExpression<TVisitor extends IAndExpressionVisitor> extends IBinaryExpression<TVisitor> {
}

export interface INotExpressionVisitor {
  visitNotExpression(expr: INotExpression<this>);
}

export interface INotExpression<TVisitor extends INotExpressionVisitor> extends IValue<TVisitor> {
  getInner(): IValue<TVisitor>;
}

export interface IEqExpressionVisitor {
  visitEqExpression(expr: IEqExpression<this>);
}
export interface IEqExpression<TVisitor extends IEqExpressionVisitor> extends IBinaryExpression<TVisitor> {
}

export interface IBinaryExpression<TVisitor> extends IValue<TVisitor> {
  getLhs(): IValue<TVisitor>;
  getRhs(): IValue<TVisitor>;
}

export interface IParenthesesVisitor {
  visitParentheses(expr: IParentheses<this>);
}
export interface IParentheses<TVisitor extends IParenthesesVisitor> extends IValue<TVisitor> {
  getInner(): IValue<TVisitor>;
}

export interface IPropertyValueVisitor {
  visitPropertyValue(expr: IPropertyValue<this>);
}
export interface IPropertyValue<TVisitor extends IPropertyValueVisitor> extends IValue<TVisitor> {
  getPropertyPath(): string[];
}

export interface IAnyExpressionVisitor {
  visitAnyExpression(expr: IAnyExpression<this>);
}
export interface IAnyExpression<TVisitor extends IAnyExpressionVisitor> extends IValue<TVisitor> {
  getPropertyPath(): string[];
  getLambdaExpression(): ILambdaExpression<TVisitor>;
}

export interface ILambdaExpression<TVisitor> {
  variable: string;
  expression: IValue<TVisitor>;
}
