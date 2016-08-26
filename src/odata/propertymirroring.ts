import { Property } from "./schema";

export class MirrorPropertyResolver {
  public resolveGetter(property: Property): Getter {
    if (property.mirroredFromProperty() !== undefined) {
      let firstProperty = property.mirroredFromProperty();
      let secondProperty = property.mirroredFromProperty().getEntityType().getProperty("Id");
      return [firstProperty, secondProperty];
    }
    else return [property];
  }
}

export type Getter = Property[];
