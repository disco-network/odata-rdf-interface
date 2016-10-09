import base = require("../../odata/queryengine");
import { Schema } from "../../odata/schema";
import { EdmConverter } from "../../odata/edm";
import { ISparqlProvider } from "../../sparql/sparql_provider_base";

import { EntityInitializer } from "../odata/entityinitializer";
import { GetRequestParser, PostRequestParser } from "../odata/parser";
import { ODataRepository } from "./odatarepository";
import { IMinimalVisitor } from "./filters";

export { OptionsHandler } from "../../odata/queryengine"

export class GetHandler extends base.GetHandler<IMinimalVisitor> {
  constructor(schema: Schema, sparqlProvider: ISparqlProvider, graphUri: string) {
    super(schema, new GetRequestParser(), new ODataRepository(sparqlProvider, graphUri), new base.GetHttpResponder());
  }
}

export class PostHandler extends base.PostHandler<IMinimalVisitor> {
  constructor(schema: Schema, sparqlProvider: ISparqlProvider, graphUri: string) {
    super(new PostRequestParser(), new EntityInitializer(new EdmConverter()),
          new ODataRepository(sparqlProvider, graphUri), schema);
  }
}
