import { Property } from "./schema";
import { EdmLiteral } from "./edm";

export class ForeignKeyPropertyResolver {
  public resolveGetter(property: Property): Getter {
    if (property.foreignProperty() !== undefined) {
      let firstProperty = property.foreignProperty();
      let secondProperty = property.foreignProperty().getEntityType().getProperty("Id");
      return [firstProperty, secondProperty];
    }
    else return [property];
  }

  public resolveSetter(property: Property, value: EdmLiteral): Setter {
    if (property.foreignProperty() !== undefined) {
      let firstProperty = property.foreignProperty();
      let secondProperty = firstProperty.getEntityType().getProperty("Id");
      return {
        property: firstProperty,
        value: {
          type: "ref",
          indexProperty: secondProperty,
          id: value,
        },
      };
    }
    else {
      return {
        property: property,
        value: value,
      };
    }
  }
}

export type Getter = Property[];
export interface Setter {
  property: Property;
  value: SetterValue;
}

export type  SetterValue = EdmLiteral | Ref;

export interface Ref {
  type: "ref";
  indexProperty: Property;
  id: EdmLiteral;
}
