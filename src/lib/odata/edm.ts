export class EdmConverter implements IEdmConverter {
  public convert(source: EdmLiteral, target: string, nullable = false): EdmLiteral {
    switch (source.type) {
      case "Edm.String": return this.assignStringTo(source, target);
      case "Edm.Int32": return this.assignInt32To(source, target);
      case "Edm.Guid": return this.assignGuidTo(source, target);
      case "null":
        if (nullable === true) return source;
        else return this.cantConvert(source, target, "trying to assign null to a non-nullable type");
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
      if (parsed === Infinity) return this.cantConvert(source, target, `${source.value} is too big for Edm.Int32`);
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
    throw new InvalidConversionError(source, target);
  }

  private unknownType(source: never, target: string) {
    return this.cantConvert(source, target);
  }
}

export class InvalidConversionError {
  public message: string;

  constructor(public source: EdmLiteral, public target: string, message?: string) {
    this.message = `Literal of type ${source.type} cannot be converted to ${target}${message ? ": " + message : ""}`;
  }
}

export interface IEdmConverter {
  convert<V extends string>(source: EdmLiteral, target: V): EdmLiteral & { type: V };
  convert<V extends string>(source: EdmLiteral, target: V, nullable: false): EdmLiteral & { type: V };
  convert<V extends string>(source: EdmLiteral, target: V, nullable: true): EdmLiteral & { type: "null" | V };
  convert<V extends string>
    (source: EdmLiteral, target: V, nullable: boolean): EdmLiteral & { type: "null" | V };
}

export type EdmLiteral = EdmStringLiteral | EdmInt32Literal | EdmGuidLiteral | NullLiteral;
export type EdmLiteralType = "Edm.String" | "Edm.Int32" | "Edm.Guid" | "null";

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

export interface NullLiteral {
  type: "null";
}
