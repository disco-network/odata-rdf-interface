import base = require("../querystringbuilder");

export class SelectQueryStringBuilder extends base.SelectQueryStringBuilder {
  constructor() {
    super(new SelectSkeletonBuilder(), new GraphPatternStringBuilder());
  }
}

export class SelectSkeletonBuilder extends base.SelectSkeletonBuilder {
}

export class GraphPatternStringBuilder extends base.GraphPatternStringBuilder {
}
