import base = require("../../sparql/querystringbuilder");

export class SelectQueryStringBuilder extends base.SelectQueryStringBuilder {
  constructor() {
    super(new SelectSkeletonBuilder(), new GraphPatternStringBuilder());
  }
}

export let SelectSkeletonBuilder = base.SelectSkeletonBuilder;
export let GraphPatternStringBuilder = base.GraphPatternStringBuilder;
