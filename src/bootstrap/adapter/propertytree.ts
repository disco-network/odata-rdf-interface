import propertyTrees = require("../../adapter/propertytree/propertytree");
import propertyTreesImpl = require("../../adapter/propertytree/propertytree_impl");
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
  const patternMatcher = new propertyTrees.TreeDependencyInjector();
  patternMatcher.registerFactoryCandidates(
      new propertyTreesImpl.ElementarySingleValuedBranchFactory(patternMatcher),
      new propertyTreesImpl.ComplexBranchFactory()
    );
  return patternMatcher;
}
