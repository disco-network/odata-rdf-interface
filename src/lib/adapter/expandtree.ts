import { TreeGraphPattern } from "../sparql/graphpatterns";
import { IStructuredSparqlVariableMapping, Mapping, PropertyMapping, ScopedMapping } from "./mappings";
import { EntityType } from "../odata/schema";
import { IBranchFactory, Tree } from "./propertytree/propertytree";
import propertyTreeImpl = require("./propertytree/propertytree_impl");
import { TraversingArgs } from "./propertytree/traversingargs";
import { IBranchingArgs, PropertyBranchingArgsFactory, TypeConditionBranchingArgs } from "./propertytree/branchingargs";
import { PropertySelectionTree, IPropertySelector, PropertySelector } from "../odata/propertyselector";

export interface IExpandTreeGraphPatternStrategy {

  create(entityType: EntityType, expandTree, variableMapping: IStructuredSparqlVariableMapping): TreeGraphPattern;
  createFromSelectionTree(entityType: EntityType, variableMapping: IStructuredSparqlVariableMapping,
    selectionTree: PropertySelectionTree): TreeGraphPattern;
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

  public create(entityType: EntityType, expandTree,
    variableMapping: IStructuredSparqlVariableMapping) {
    return this.createFromSelectionTree(entityType, variableMapping,
      this.propertySelector.selectPropertiesForQuery(entityType, expandTree));
  }

  public createFromSelectionTree(entityType: EntityType,
    variableMapping: IStructuredSparqlVariableMapping,
    selectionTree: PropertySelectionTree) {

    const tree = this.createTreeFromSelectionTree(entityType, selectionTree);
    const result = new TreeGraphPattern(variableMapping.getVariable());
    const mapping = new Mapping(
      new PropertyMapping(entityType),
      variableMapping
    );

    try {

      tree.traverse(new TraversingArgs({
        patternSelector: /* @smell */ new propertyTreeImpl.GraphPatternSelector(result),
        mapping: mapping,
        scopedMapping: new ScopedMapping(mapping),
      }));
      return result;

    } catch (error) {
      throw new Error("Failed to traverse entity [" + entityType.getName() + "] after " + error.stack + "\n\n");
    }
  }

  public createTree(entityType: EntityType, expandTree) {

    const selectionTree = this.propertySelector.selectPropertiesForQuery(entityType, expandTree);
    return this.createTreeFromSelectionTree(entityType, selectionTree);
  }

  private createTreeFromSelectionTree(entityType: EntityType, selectionTree: PropertySelectionTree) {
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
