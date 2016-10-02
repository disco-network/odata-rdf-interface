import { EntityType, EntityKind, Property } from "./schema";

export interface IPropertySelector {
  selectPropertiesForQuery(entityType: EntityType, expand: any): PropertySelectionTree;
}

export class PropertySelector implements IPropertySelector {

  private subPropertySelector: IPropertySelector;

  constructor (subPropertySelector: IPropertySelector | undefined = undefined) {
    this.subPropertySelector = subPropertySelector || this;
  }

  public selectPropertiesForQuery(entityType: EntityType, expand: any): PropertySelectionTree {
    const that = this;
    const tree: PropertySelectionTree = {};
    const propertyNames = entityType.getPropertyNames();
    for (const propertyName of propertyNames) {
      const property = entityType.getProperty(propertyName);
      const kind: EntityKind.Complex | EntityKind.Elementary = property.getEntityKind();
      if (kind === EntityKind.Elementary) {
        selectProperty(property);
      }
      else if (kind === EntityKind.Complex) {
        if (isInExpandTree(property)) {
          selectProperty(property, selectSubProperties(property));
        }
      }
      else {
        const n: never = kind;
        throw new Error("unexpected EntityKind");
      }
    }
    return tree;

    function selectProperty(property: Property, subTree: PropertySelectionTree = {}) {
      tree[property.getName()] = subTree;
    }

    function isInExpandTree(property: Property) {
      return Object.prototype.hasOwnProperty.call(expand, property.getName()) === true;
    }

    function selectSubProperties(property: Property) {
      return that.subPropertySelector.selectPropertiesForQuery(property.getEntityType(), expand[property.getName()]);
    }
  }
}

export interface PropertySelectionTree {
  [property: string]: PropertySelectionTree;
}
