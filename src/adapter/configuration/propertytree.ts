import propertyTrees = require("../propertytree/propertytree");
import propertyTreesImpl = require("../propertytree/propertytree_impl");
import propertyMirroring = require("../propertymirroring");
import expandTreePatterns = require("../expandtree");
import filterPatterns = require("../filterpatterns");
import { PropertyBranchingArgsFactory } from "../propertytree/branchingargs";

export function getExpandTreeGraphPatternStrategy(): expandTreePatterns.ExpandTreeGraphPatternStrategy {
  return new expandTreePatterns.ExpandTreeGraphPatternStrategy(
    getBranchFactoryForExpanding(), getBranchingArgsFactory());
}

export function getFilterGraphPatternStrategy(): filterPatterns.FilterGraphPatternStrategy {
  return new filterPatterns.FilterGraphPatternStrategy(
    getBranchFactoryForFiltering());
}

function getBranchFactoryForFiltering(): propertyTrees.BranchFactory {
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

function getBranchFactoryForExpanding(): propertyTrees.BranchFactory {
  return new propertyTrees.TreeDependencyInjector()
    .registerFactoryCandidates(
      new propertyTreesImpl.ElementarySingleValuedBranchFactory(),
      new propertyTreesImpl.ComplexBranchFactory(),
      new propertyMirroring.ElementarySingleValuedMirroredBranchFactory()
    );
}
