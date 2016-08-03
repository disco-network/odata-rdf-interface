import results = require("../result");
import odataParser = require("../odata/odata_parser_base");
import entityReader = require("../odata/entity_reader_base");
import dataProvider = require("../odata/data_provider");
import schema = require("../odata/schema");

export interface IQueryEngine {
  queryGET(query: string, cb: (result: results.AnyResult) => void): void;
  queryPOST(query: string, body: string, cb: (result: results.AnyResult) => void): void;
}

export class QueryEngine implements IQueryEngine {

  private odataParser: odataParser.IODataParserBase;
  private entityReader: entityReader.IEntityReaderBase;
  private dataProvider: dataProvider.IDataProviderBase;
  private schema: schema.Schema;

  public queryGET(query: string, cb: (result: results.AnyResult) => void) {
    //
  }

  public queryPOST(query: string, body: string, cb: (result: results.AnyResult) => void) {
    /* @todo verify AST */
    let ast = this.odataParser.parsePOST(query);
    let type = this.schema.getEntitySet(ast.resourcePath.entitySetName).getEntityType();
    let entity = this.entityReader.fromJson(body, type);
    this.dataProvider.insertEntity(entity, type, result => {
      cb(result);
    });
  }

  public setODataParser(parser: odataParser.IODataParserBase) {
    this.odataParser = parser;
  }

  public setEntityReader(reader: entityReader.IEntityReaderBase) {
    this.entityReader = reader;
  }

  public setDataProvider(provider: dataProvider.IDataProviderBase) {
    this.dataProvider = provider;
  }

  public setSchema(schm: schema.Schema) {
    this.schema = schm;
  }
}
