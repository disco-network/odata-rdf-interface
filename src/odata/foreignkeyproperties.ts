import { Property, EntityType } from "./schema";

export class ForeignKeyPropertyResolver {
  public resolveGetter(property: Property): Getter {
    if (property.foreignProperty() !== undefined) {
      let firstProperty = property.foreignProperty();
      let secondProperty = property.foreignProperty().getEntityType().getProperty("Id");
      return [firstProperty, secondProperty];
    }
    else return [property];
  }

  public resolveSetter(property: Property, value: any): Setter {
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
        value: {
          type: "value",
          value: value,
        },
      };
    }
  }
}

export type Getter = Property[];
export interface Setter {
  property: Property;
  value: Value | Ref;
}

export interface Value {
  type: "value";
  value: any;
}

export interface Ref {
  type: "ref";
  indexProperty: Property;
  id: number;
}
