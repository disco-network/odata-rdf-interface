export class EdmConverter implements IEdmConverter<EdmLiteralType> {
  public convert(source: EdmLiteral, target: string): EdmLiteral {
    switch (source.type) {
      case "Edm.String": return this.assignStringTo(source, target);
      case "Edm.Int32": return this.assignInt32To(source, target);
      case "Edm.Guid": return this.assignGuidTo(source, target);
      default: return this.unknownType(source, target);
    }
  }

  private assignStringTo(source: EdmStringLiteral, target: string): EdmLiteral {
    if (target === "Edm.String") return {
      type: "Edm.String",
      value: source.value,
    };
    else if (target === "Edm.Int32") {
      const parsed = parseInt(source.value, 10);
      if (isNaN(parsed)) return this.cantConvert(source, target, `${source.value} is not a decimal integer`);
      if (parsed === Infinity) return this.cantConvert(source, target, `${source.value} is too big for Edm.Int32`)
      return {
        type: "Edm.Int32",
        value: parsed,
      };
    }
    else return this.cantConvert(source, target);
  }

  private assignInt32To(source: EdmInt32Literal, target: string): EdmLiteral {
    if (target === "Edm.Int32") return {
      type: "Edm.Int32",
      value: source.value,
    };
    else return this.cantConvert(source, target);
  }

  private assignGuidTo(source: EdmGuidLiteral, target: string): EdmLiteral {
    if (target === "Edm.Guid") return {
      type: "Edm.Guid",
      value: source.value,
    };
    else return this.cantConvert(source, target);
  }

  private cantConvert(source: EdmLiteral, target: string, msg?: string): never {
    throw new Error(`Cannot convert from ${source.type} to ${target}` + (msg ? `: ${msg}` : ``));
  }

  private unknownType(source: never, target: string) {
    return this.cantConvert(source, target);
  }
}

export interface IEdmConverter<T extends string> {
  convert(source: { type: T }, target: T): { type: T };
}

export type EdmLiteral = EdmStringLiteral | EdmInt32Literal | EdmGuidLiteral;
export type EdmLiteralType = "Edm.String" | "Edm.Int32" | "Edm.Guid";

export interface EdmStringLiteral {
  type: "Edm.String";
  value: string;
}

export interface EdmInt32Literal {
  type: "Edm.Int32";
  value: number;
}

export interface EdmGuidLiteral {
  type: "Edm.Guid";
  value: string;
}
