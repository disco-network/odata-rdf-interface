import base = require("../../odata/queryengine");
import { IHttpResponseSender } from "../../odata/http";
import { Schema } from "../../odata/schema";
import { GetRequestParser } from "../odata/parser";
import { ISparqlProvider } from "../../sparql/sparql_provider_base";
import { ODataRepository } from "./odatarepository";

export class GetHandler extends base.GetHandler {
  constructor(schema: Schema, sparqlProvider: ISparqlProvider, responseSender: IHttpResponseSender) {
    super(schema, new GetRequestParser(), new ODataRepository(sparqlProvider),
      new base.GetResponseSender(responseSender));
  }
}

export let OptionsHandler = base.OptionsHandler;
