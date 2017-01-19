import base = require("../../odata/queryengine");
import { Schema } from "../../odata/schema";
import { EdmConverter } from "../../odata/edm";
import { ISparqlProvider } from "../../sparql/sparql_provider_base";

import { EntityInitializer } from "../odata/entityinitializer";
import { GetRequestParser, PostRequestParser, PatchRequestParser } from "../odata/parser";
import { ODataRepository } from "./odatarepository";
import { IMinimalVisitor } from "./filters";
import { ILogger } from "../../logger";

export { OptionsHandler } from "../../odata/queryengine"

export class GetHandler extends base.GetHandler<IMinimalVisitor> {
  constructor(serviceUri: string, schema: Schema, sparqlProvider: ISparqlProvider, graphUri: string, logger?: ILogger) {
    super(
      schema, new GetRequestParser(), new ODataRepository(serviceUri, sparqlProvider, graphUri),
      new base.GetHttpResponder(),
      logger);
  }
}

export class PostHandler extends base.PostHandler<IMinimalVisitor> {
  constructor(serviceUri: string, schema: Schema, sparqlProvider: ISparqlProvider, graphUri: string) {
    super(new PostRequestParser(), new EntityInitializer(new EdmConverter()),
      new ODataRepository(serviceUri, sparqlProvider, graphUri), schema);
  }
}

export class PatchHandler extends base.PatchHandler<IMinimalVisitor> {
  constructor(serviceUri: string, schema: Schema, sparqlProvider: ISparqlProvider, graphUri: string) {
    super(new PatchRequestParser(), schema, new EntityInitializer(new EdmConverter()),
      new ODataRepository(serviceUri, sparqlProvider, graphUri));
  }
}
