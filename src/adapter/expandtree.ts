import gpatterns = require("../sparql/graphpatterns");
import mappings = require("./mappings");
import schema = require("../odata/schema");
import { IBranchFactory, Tree } from "./propertytree/propertytree";
import propertyTreeImpl = require("./propertytree/propertytree_impl");
import { TraversingArgs } from "./propertytree/traversingargs";
import { IBranchingArgs, PropertyBranchingArgsFactory, TypeConditionBranchingArgs } from "./propertytree/branchingargs";
import { PropertySelectionTree, IPropertySelector, PropertySelector } from "../odata/propertyselector";

/**
 * Creates a SPARQL graph pattern involving all direct and elementary
 * properties belonging to the OData entity type passed as schema.
 * Please separate the options like this: "no-id-property|some-other-option"
 */
export class DirectPropertiesTreeStrategy {

  constructor(private branchFactory: IBranchFactory<IBranchingArgs>,
              private argsFactory: PropertyBranchingArgsFactory) {}

  public create(entityType: schema.EntityType,
                options: string): Tree {

    let tree = new Tree();

    let propertyNames = entityType.getPropertyNames();
    let properties = propertyNames.map(p => entityType.getProperty(p));

    for (let i = 0; i < properties.length; ++i) {
      let property = properties[i];
      let propertyName = property.getName();
      if (propertyName === "Id" && options.indexOf("no-id-property") >= 0) continue;
      if (property.getEntityKind() === schema.EntityKind.Elementary) {
        let args = this.argsFactory.fromProperty(property);
        tree.branchNode(this.branchFactory.create(args));
      }
    }

    return tree;
  }
}

/**
 * Creates a SPARQL graph pattern depending an entity type schema, an expand tree
 * (only considering complex properties) and a StructuredSparqlVariableMapping
 * so that it contains all data necessary for an OData $expand query.
 */
export class ExpandTreeGraphPatternStrategy {

  private propertySelector: IPropertySelector = new PropertySelector();

  constructor(private branchFactory: IBranchFactory<IBranchingArgs>,
              private argsFactory: PropertyBranchingArgsFactory) {
  }

  public create(entityType: schema.EntityType, expandTree,
                variableMapping: mappings.IStructuredSparqlVariableMapping) {
    return this.createFromSelectionTree(entityType, variableMapping,
                                        this.propertySelector.selectPropertiesForQuery(entityType, expandTree));
  }

  public createFromSelectionTree(entityType: schema.EntityType,
                                 variableMapping: mappings.IStructuredSparqlVariableMapping,
                                 selectionTree: PropertySelectionTree) {

    const tree = this.createTreeFromSelectionTree(entityType, selectionTree);
    const result = new gpatterns.TreeGraphPattern(variableMapping.getVariable());
    const mapping = new mappings.Mapping(
      new mappings.PropertyMapping(entityType),
      variableMapping
    );
    tree.traverse(new TraversingArgs({
      patternSelector: /* @smell */ new propertyTreeImpl.GraphPatternSelector(result),
      mapping: mapping,
      scopedMapping: new mappings.ScopedMapping(mapping),
    }));
    return result;
  }

  public createTree(entityType: schema.EntityType, expandTree) {

    const selectionTree = this.propertySelector.selectPropertiesForQuery(entityType, expandTree);
    return this.createTreeFromSelectionTree(entityType, selectionTree);
  }

  private createTreeFromSelectionTree(entityType: schema.EntityType, selectionTree: PropertySelectionTree) {
    const tree = new Tree();

    if (entityType.isElementary() === false)
      tree.branchNode(this.branchFactory.create(new TypeConditionBranchingArgs(entityType)));

    for (const propertyName of Object.keys(selectionTree)) {
      const property = entityType.getProperty(propertyName);

      const branch = tree.branchNode(this.branchFactory.create(this.argsFactory.fromProperty(property)));

      const recursive = this.createTreeFromSelectionTree(property.getEntityType(), selectionTree[propertyName]);
      recursive.copyTo(branch);
    }

    return tree;
  }
}
