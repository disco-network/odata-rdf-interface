import openArgs = require("./openargs");
import mappings = require("./mappings");
import propertyTree = require("./propertytree");

export let GraphPatternContract = new openArgs.ContractSpecification<GraphPatternContract>();

export interface GraphPatternContract extends openArgs.ContractImplementer {
  get(): propertyTree.GraphPatternSelector;
}

export class GraphPatternContractImpl implements GraphPatternContract {

  constructor(private value: propertyTree.GraphPatternSelector) {
  }

  public initializeWithPreviousArgs(args: openArgs.OpenArgsReadonly) {
    // do nothing
  }

  public get(): propertyTree.GraphPatternSelector {
    return this.value;
  }
}

export let MappingContract = new openArgs.ContractSpecification<MappingContract>();

export interface MappingContract extends openArgs.ContractImplementer {
  getMapping(): mappings.Mapping;
}

export class MappingContractImpl implements MappingContract {

  constructor(private value: mappings.Mapping) {
  }

  public initializeWithPreviousArgs(args: openArgs.OpenArgsReadonly) {
    // do nothing
  }

  public getMapping(): mappings.Mapping {
    return this.value;
  }
}

export let ScopedMappingContract = new openArgs.ContractSpecification<ScopedMappingContract>();

export interface ScopedMappingContract extends openArgs.ContractImplementer {
  getScopedMapping(): mappings.ScopedMapping;
}

export class ScopedMappingContractImpl implements ScopedMappingContract {

  constructor(private value: mappings.ScopedMapping) {
  }

  public initializeWithPreviousArgs(args: openArgs.OpenArgsReadonly) {
    // do nothing
  }

  public getScopedMapping(): mappings.ScopedMapping {
    return this.value;
  }
}
