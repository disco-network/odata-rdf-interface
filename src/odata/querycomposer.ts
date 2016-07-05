/** @module */
import _ = require('../util');
import Queries = require('./queries');

export class QueryComposer implements Queries.QueryModel {
  public entitySetName: string;
  public path: any[];
  public filterOption: any;
  public expandTree: any;

  private schema: any;
  private currentSchema: any;
  private currentIsCollection: boolean;

  constructor(entitySetName: string, schema) {
    this.entitySetName = entitySetName;
    this.path = [];
    this.schema = schema;
    this.currentSchema = schema.entitySets[entitySetName];
    this.currentIsCollection = true;
  }
  
  public filter(filterOption): void {
    this.filterOption = filterOption;
  }

  public expand(expandOption): void {
    var expandTree = this.expandTree = {};
    (expandOption || []).forEach(function(e) {
      var currentBranch = expandTree;
      e.path.forEach(prop => {
        currentBranch = currentBranch[prop] = currentBranch[prop] || {};
      });
    })
  }

  public selectById(id): void {
    if(!this.currentIsCollection) throw new Error('current query part should be a collection');
    this.path.push({ type: 'by-id', id: id, resultQuantity: 'one' });
    this.currentIsCollection = false;
    this.currentSchema = this.schema.entityTypes[this.currentSchema.type];
  }

  public selectProperty(property: string): void {
    if(this.currentIsCollection) throw new Error('current query part should be no collection');
    if(this.currentSchema.properties[property] == null) throw new Error('property does not exist: ' + property);
    var propertySchema = this.currentSchema.properties[property];
    this.currentIsCollection = propertySchema.quantity == 'one-to-many' || propertySchema.quantity == 'many-to-many';
    this.path.push({ type: 'property', name: property, resultQuantity: 'many' });
    if(this.currentIsCollection)
      this.currentSchema = this.collectionSchema(propertySchema.type);
    else
      this.currentSchema = this.singleSchema(propertySchema.type);
  }

  public collectionSchema(type) {
    return { type: type };
  }

  public singleSchema(type) {
    return this.schema.entityTypes[type];
  }
}