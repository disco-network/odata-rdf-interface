import { Property } from "./schema";

/* @construction integrate this */
export class ForeignKeyPropertyResolver {
  public resolveGetter(property: Property): Getter {
    if (property.foreignProperty() !== undefined) {
      let firstProperty = property.foreignProperty();
      let secondProperty = property.foreignProperty().getEntityType().getProperty("Id");
      return [firstProperty, secondProperty];
    }
    else return [property];
  }
}

export type Getter = Property[];
