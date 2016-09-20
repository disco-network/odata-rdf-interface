import base = require("../../odata/queryengine");
import { Schema } from "../../odata/schema";
import { ISparqlProvider } from "../../sparql/sparql_provider_base";

import { EntityInitializer } from "../odata/entityreader";
import { GetRequestParser, PostRequestParser } from "../odata/parser";
import { ODataRepository } from "./odatarepository";
import { IVisitor } from "./filters";

export class GetHandler extends base.GetHandler<IVisitor> {
  constructor(schema: Schema, sparqlProvider: ISparqlProvider) {
    super(schema, new GetRequestParser(), new ODataRepository(sparqlProvider), new base.GetHttpResponder());
  }
}

export class PostHandler extends base.PostHandler<IVisitor> {
  constructor(schema: Schema, sparqlProvider: ISparqlProvider) {
    super(new PostRequestParser(), new EntityInitializer(), new ODataRepository(sparqlProvider), schema);
  }
}

export let OptionsHandler = base.OptionsHandler;
