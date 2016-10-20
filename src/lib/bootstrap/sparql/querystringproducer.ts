import base = require("../../sparql/querystringproducer");

export class SelectQueryStringBuilder extends base.SelectQueryStringProducer {
  constructor() {
    super(new PrefixProducer(), new SelectSkeletonProducer(), new GraphPatternStringProducer());
  }
}

export let SelectSkeletonProducer = base.SelectSkeletonProducer;
export let GraphPatternStringProducer = base.GraphPatternStringProducer;
export let PrefixProducer = base.PrefixProducer;
