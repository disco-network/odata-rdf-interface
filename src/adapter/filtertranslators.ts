import { IScope, ILambdaVariable, UniqueScopeIdentifier } from "../odata/filters/filters";
import { ScopedPropertyTree } from "../odata/filters/propertytree";
import { IValue, IBinaryExpression,
  IStringLiteralVisitor, IStringLiteral,
  INumericLiteralVisitor, INumericLiteral,
  INullVisitor, INull,
  IAndExpressionVisitor, IAndExpression,
  IOrExpressionVisitor, IOrExpression,
  IEqExpressionVisitor, IEqExpression,
  IParenthesesVisitor as IParenthesesVisitorImported, IParentheses,
  IPropertyValueVisitor, IPropertyValue,
  IAnyExpressionVisitor, IAnyExpression } from "../odata/filters/expressions";

import { PropertyPath, PropertyValueTranslator,
  IAnyExpressionTranslatorFactory } from "./filters/propertyexpression";
import { ScopedMapping } from "./mappings";

export { PropertyPath } from "./filters/propertyexpression";

export interface IExpressionTranslatorFactory<TVisitor> {
  create(expression: IValue<TVisitor>, context?: IFilterContext): IExpressionTranslator;
}

export interface IVisitor {
  passResult(result: IExpressionTranslator);
  getState(): IVisitorState;
  create(expression: IValue<this>, context: IFilterContext): IExpressionTranslator;
  create(expression: IValue<this>): IExpressionTranslator;
}

export class VisitorBase implements IVisitor {
  private lastResult: IExpressionTranslator;

  constructor(private state: IVisitorState) {}

  public passResult(result: IExpressionTranslator): any {
    this.lastResult = result;
  }

  public getState(): IVisitorState {
    return this.state;
  }

  public create(expression: IValue<this>, context = this.getState().filterContext): IExpressionTranslator {
    return this.withFilterContext(context, () => {
      expression.accept(this);
      return this.lastResult;
    });
  }

  public withFilterContext<T>(context: IFilterContext, fn: () => T): T {
    const old = this.getState().filterContext;
    this.getState().filterContext = context;
    const result = fn();
    this.getState().filterContext = old;
    return result;
  }
}

export interface IEqualsUriExpressionVisitor {
  visitEqualsUriExpression(expr: IEqualsUriExpression<this>): void;
}

export interface IEqualsUriExpression<TVisitor extends IEqualsUriExpressionVisitor> extends IValue<TVisitor> {
  getUri(): string;
  accept(visitor: TVisitor): void;
}

export interface ITypeofVisitor<T extends IVisitor> {
  new(state: IVisitorState): T;
}

export interface IVisitorConstructible extends ITypeofVisitor<IVisitor> {}

export function AssembledVisitor<T extends IVisitor>
  (BaseClass: IVisitorConstructible, Extensions: ((From: IVisitorConstructible) => IVisitorConstructible)[]) {

  let Result = BaseClass;
  for (let Extension of Extensions) {
    Result = Extension(Result);
  }
  return Result as ITypeofVisitor<T>;
}

export interface ILiteralVisitor
  extends IStringLiteralVisitor, INumericLiteralVisitor, INullVisitor {}

export function LiteralVisitor
  (Base: IVisitorConstructible) {

  return class Visitor extends Base implements ILiteralVisitor {

    constructor(state: IVisitorState) {
      super(state);
    }

    public visitStringLiteral(expr: IStringLiteral<this>) {
      this.passResult(new LiteralTranslator<string>(expr.getString(), str => "'" + str + "'"));
    }

    public visitNumericLiteral(expr: INumericLiteral<this>) {
      this.passResult(new LiteralTranslator<number>(expr.getNumber(), num => "'" + num + "'"));
    }

    public visitNull(expr: INull<this>) {
      this.passResult(new NullTranslator());
    }
  } as IVisitorConstructible;
}

export interface IBinaryExprVisitor
  extends IAndExpressionVisitor, IOrExpressionVisitor, IEqExpressionVisitor {}

export function BinaryExprVisitor
  (Base: IVisitorConstructible) {

  return class Visitor extends Base implements IBinaryExprVisitor {

    constructor(state: IVisitorState) {
      super(state);
    }

    public visitAndExpression(expr: IAndExpression<this>) {
      this.visitBinaryExpression(expr, "&&");
    }

    public visitOrExpression(expr: IOrExpression<this>) {
      this.visitBinaryExpression(expr, "||");
    }

    public visitEqExpression(expr: IEqExpression<this>) {
      const [lhs, rhs] = this.createBinaryOperands(expr);
      this.passResult(new EqExpressionTranslator(lhs, rhs) as any);
    }

    private visitBinaryExpression(expr: IBinaryExpression<this>, sparqlOperator: string) {
      let [lhs, rhs] = this.createBinaryOperands(expr);
      this.passResult(new BinaryOperatorTranslator(lhs, sparqlOperator, rhs));
    }

    private createBinaryOperands(expr: IBinaryExpression<this>) {
      return [ this.create(expr.getLhs()), this.create(expr.getRhs()) ];
    }
  } as IVisitorConstructible;
}

export class EqExpressionTranslator implements IExpressionTranslator {
  constructor(private lhs: IExpressionTranslator, private rhs: IExpressionTranslator) {}

  public getPropertyTree(): ScopedPropertyTree {
    return FilterExpressionHelper.getPropertyTree([ this.lhs, this.rhs ]);
  }

  public toSparqlFilterClause() {
    const lhs = this.lhs.toSparqlFilterClause();
    const rhs = this.rhs.toSparqlFilterClause();
    const clauseWithoutBoundCondition = `(${lhs} = ${rhs})`;
    if (this.lhs.canBeUnbound() === false || this.rhs.canBeUnbound() === false)
      return clauseWithoutBoundCondition;
    else {
      const boundCondition = `!(BOUND(${lhs}) || BOUND(${rhs}))`;
      return `(${clauseWithoutBoundCondition} || ${boundCondition})`;
    }
  }

  public canBeUnbound() {
    return false;
  }
}

export interface IParenthesesVisitor extends IParenthesesVisitorImported {}

export function ParenthesesVisitor(Base: IVisitorConstructible) {

  return class extends Base implements IParenthesesVisitor {

    constructor(state: IVisitorState) {
      super(state);
    }

    public visitParentheses(expr: IParentheses<this>) {
      this.passResult(this.create(expr.getInner()));
    }
  } as IVisitorConstructible;
}

export interface IPropertyVisitor extends IPropertyValueVisitor, IAnyExpressionVisitor {}

export function generatePropertyVisitor(anyTranslatorFactory: IAnyExpressionTranslatorFactory) {
  return function(Base: IVisitorConstructible): IVisitorConstructible {

    return class Visitor extends Base implements IPropertyVisitor {

      constructor(state: IVisitorState) {
        super(state);
      }

      public visitPropertyValue(expr: IPropertyValue<this>) {
        const path = new PropertyPath(expr.getPropertyPath(), this.getState().filterContext);
        this.passResult(new PropertyValueTranslator(path, this.getState().filterContext));
      }

      public visitAnyExpression(expr: IAnyExpression<this>) {
        const path = new PropertyPath(expr.getPropertyPath(), this.getState().filterContext);
        const variable = this.createLambdaVariable(path, expr.getLambdaExpression().variable);
        const expression = this.create(expr.getLambdaExpression().expression,
                                      this.createFilterContextInsideLambda(path, variable));

        /* @todo move scoping logic to /odata/ into ScopeAwareWalker class */
        this.passResult(anyTranslatorFactory.create(
          expr.getPropertyPath(), variable, expression, this.getState().filterContext));
      }

      private createFilterContextInsideLambda(path: PropertyPath, variable: ILambdaVariable): IFilterContext {
        return {
          mapping: {
            scope: this.getState().filterContext.mapping.scope.scope(variable.scopeId),
          },
          scope: {
            entityType: this.getState().filterContext.scope.entityType,
            lambdaVariableScope: this.getState().filterContext.scope.lambdaVariableScope.clone().add(variable),
          },
        };
      }

      private createLambdaVariable(path: PropertyPath, variable: string): ILambdaVariable {
        return {
          name: variable,
          entityType: path.getFinalEntityType(),
          scopeId: new UniqueScopeIdentifier("any"),
        };
      }
    } as IVisitorConstructible;
  };
}

export function EqualsUriExpressionVisitor(Base: IVisitorConstructible): IVisitorConstructible {
  return class extends Base implements IEqualsUriExpressionVisitor {
    public visitEqualsUriExpression(expr: IEqualsUriExpression<this>) {
      const variable = this.getState().filterContext.mapping.scope.unscoped().variables.getVariable();
      this.passResult(new EqualsUriExpressionTranslator(expr.getUri(), variable));
    }
  };
}

export class EqualsUriExpressionTranslator implements IExpressionTranslator {

  constructor(private uri: string, private variable: string) {}

  public getPropertyTree() {
    return ScopedPropertyTree.create();
  }

  public toSparqlFilterClause(): string {
    return `( ${this.variable} = <${this.uri}> )`; // @<uri> generation: avoid SPARQL injection
  }

  public canBeUnbound() {
    return false;
  }
}

export interface IVisitorState {
  filterContext: IFilterContext;
}

export class NullTranslator implements IExpressionTranslator {

  public getPropertyTree() {
    return ScopedPropertyTree.create();
  }

  public toSparqlFilterClause() {
    return "?__null__";
  }

  public canBeUnbound() {
    return true;
  }
}

export class LiteralTranslator<ValueType> implements IExpressionTranslator {

  private value: ValueType;

  constructor(value: ValueType, private toSparql: (v: ValueType) => string) {
    this.value = value;
  }

  public getPropertyTree(): ScopedPropertyTree {
    return ScopedPropertyTree.create();
  }

  public toSparqlFilterClause(): string {
    return this.toSparql(this.value);
  }

  public canBeUnbound() {
    return false;
  }
}

export class BinaryOperatorTranslator implements IExpressionTranslator {

  constructor(private lhs: IExpressionTranslator,  private sparqlOperator: string,
              private rhs: IExpressionTranslator) {
  }

  public getPropertyTree(): ScopedPropertyTree {
    return FilterExpressionHelper.getPropertyTree([ this.lhs, this.rhs ]);
  }

  public toSparqlFilterClause(): string {
    return `(${this.lhs.toSparqlFilterClause()} ${this.sparqlOperator} ${this.rhs.toSparqlFilterClause()})`;
  }

  public canBeUnbound() {
    return false;
  }
}

export class FilterExpressionHelper {
  public static getPropertyTree(subExpressions: IExpressionTranslator[]): ScopedPropertyTree {
    let propertyTrees = subExpressions.map(se => se.getPropertyTree());
    let result = ScopedPropertyTree.create();
    propertyTrees.forEach(tree => {
      result.merge(tree);
    });
    return result;
  }
}

export class Factory<TVisitor> {
  private visitor: TVisitor;
  public process(expr: IValue<TVisitor>) {
    expr.accept(this.visitor);
  }
}

export interface IExpressionTranslator {
  getPropertyTree(): ScopedPropertyTree;
  toSparqlFilterClause(): string;
  canBeUnbound(): boolean;
}

export interface IFilterContext {
  scope: IScope;
  mapping: IFilterMappingContext;
}

export interface IFilterMappingContext {
  scope: ScopedMapping;
}
