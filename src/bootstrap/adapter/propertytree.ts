import propertyTrees = require("../../adapter/propertytree/propertytree");
import propertyTreesImpl = require("../../adapter/propertytree/propertytree_impl");
import propertyMirroring = require("../../adapter/propertymirroring");
import expandTreePatterns = require("../../adapter/expandtree");
import filterPatterns = require("../../adapter/filterpatterns");
import { PropertyBranchingArgsFactory, IBranchingArgs } from "../../adapter/propertytree/branchingargs";

export function getExpandTreeGraphPatternStrategy(): expandTreePatterns.ExpandTreeGraphPatternStrategy {
  return new expandTreePatterns.ExpandTreeGraphPatternStrategy(
    getBranchFactoryForExpanding(), getBranchingArgsFactory());
}

export function getFilterGraphPatternStrategy(): filterPatterns.FilterGraphPatternStrategy {
  return new filterPatterns.FilterGraphPatternStrategy(
    getBranchFactoryForFiltering());
}

function getBranchFactoryForFiltering(): propertyTrees.IBranchFactory<IBranchingArgs> {
  return new propertyTrees.TreeDependencyInjector()
    .registerFactoryCandidates(
      new propertyTreesImpl.ComplexBranchFactoryForFiltering(),
      new propertyTreesImpl.ElementaryBranchFactoryForFiltering(),
      new propertyTreesImpl.InScopeVariableBranchFactory(),
      new propertyTreesImpl.AnyBranchFactory()
    );
}

function getBranchingArgsFactory(): PropertyBranchingArgsFactory {
  return new PropertyBranchingArgsFactory();
}

function getBranchFactoryForExpanding(): propertyTrees.IBranchFactory<IBranchingArgs> {
  return new propertyTrees.TreeDependencyInjector()
    .registerFactoryCandidates(
      new propertyTreesImpl.ElementarySingleValuedBranchFactory(),
      new propertyTreesImpl.ComplexBranchFactory(),
      new propertyMirroring.SingleValuedMirrorBranchFactory()
    );
}
