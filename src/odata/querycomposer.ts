/** @module */
import Queries = require("./queries");
import schema = require("./schema");

export class QueryComposer implements Queries.IQueryModel {
  public entitySetType: schema.EntityType;
  public path: any[];
  public filterOption: any;
  public expandTree: any;

  private schema: schema.Schema;
  private currentSchema: schema.EntityType;
  private currentIsCollection: boolean;

  constructor(entitySetName: string, schema: schema.Schema) {
    this.entitySetType = schema.getEntitySet(entitySetName).getEntityType();
    this.path = [];
    this.schema = schema;
    this.currentSchema = this.entitySetType;
    this.currentIsCollection = true;
  }

  public filter(filterOption): void {
    this.filterOption = filterOption;
  }

  public expand(expandOption): void {
    let expandTree = this.expandTree = {};
    (expandOption || []).forEach(function(e) {
      let currentBranch = expandTree;
      e.path.forEach(prop => {
        currentBranch = currentBranch[prop] = currentBranch[prop] || {};
      });
    });
  }

  public selectById(id): void {
    if (!this.currentIsCollection) throw new Error("current query part should be a collection");
    this.path.push({ type: "by-id", id: id, resultQuantity: "one" });
    this.currentIsCollection = false;
  }

  public selectProperty(property: string): void {
    if (this.currentIsCollection) throw new Error("current query part should be no collection");
    if (this.currentSchema.getProperty(property) === undefined) throw new Error("property does not exist: " + property);
    let propertySchema = this.currentSchema.getProperty(property);
    this.currentIsCollection = !propertySchema.isCardinalityOne();
    this.path.push({ type: "property", name: property, resultQuantity: this.currentIsCollection ? "many" : "one" });
    this.currentSchema = propertySchema.getEntityType();
  }
}
