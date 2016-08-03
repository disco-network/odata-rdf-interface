import mappings = require("../mappings");
import gpatterns = require("../../sparql/graphpatterns");

export class TraversingArgs implements ITraversingArgs {
  public patternSelector: IGraphPatternSelector;
  public mapping: mappings.Mapping;
  public scopedMapping: mappings.ScopedMapping;

  constructor(explicitArgs?: {
                               patternSelector: IGraphPatternSelector,
                               mapping: mappings.Mapping,
                               scopedMapping: mappings.ScopedMapping,
                             }) {
    if (explicitArgs !== undefined) {
      this.patternSelector = explicitArgs.patternSelector;
      this.mapping = explicitArgs.mapping;
      this.scopedMapping = explicitArgs.scopedMapping;
    }
  }

  public clone(): ITraversingArgs {
    return new TraversingArgs({
      patternSelector: this.patternSelector,
      mapping: this.mapping,
      scopedMapping: this.scopedMapping });
  }
}

export interface IGraphPatternSelector {
  getRootPattern(): gpatterns.TreeGraphPattern;
  getUnionPatternForSingleValuedBranches(): gpatterns.TreeGraphPattern;
  getNewUnionPattern(): gpatterns.TreeGraphPattern;

  getOtherSelector(rootPattern: gpatterns.TreeGraphPattern): IGraphPatternSelector;
}

export interface ITraversingArgs extends IGraphPatterngArgs, IMappingArgs, IScopedMappingArgs {}

export interface IGraphPatterngArgs extends ITraversingArgsBase {
  patternSelector: IGraphPatternSelector;
}

export interface IMappingArgs extends ITraversingArgsBase {
  mapping: mappings.Mapping;
}

export interface IScopedMappingArgs extends ITraversingArgsBase {
  scopedMapping: mappings.ScopedMapping;
}

export interface ITraversingArgsBase {
  clone(): ITraversingArgs;
}
