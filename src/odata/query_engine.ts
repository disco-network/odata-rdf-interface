import results = require("../result");
import odataParser = require("../odata/odata_parser_base");
import entityReader = require("../odata/entity_reader_base");
import repository = require("../odata/repository");
import schema = require("../odata/schema");

export interface IQueryEngine {
  queryGET(query: string, cb: (result: results.AnyResult) => void): void;
  queryPOST(query: string, body: string, cb: (result: results.AnyResult) => void): void;
}

export class QueryEngine implements IQueryEngine {

  private schema: schema.Schema;

  constructor(private odataParser: odataParser.IODataParser,
              private entityReader: entityReader.IEntityReader,
              private repository: repository.IRepository) {
  }

  public queryGET(query: string, cb: (result: results.AnyResult) => void) {
    // @todo
  }

  public queryPOST(query: string, body: string, cb: (result: results.AnyResult) => void) {
    /* @todo verify AST */
    let ast = this.odataParser.parsePOST(query);
    let type = this.schema.getEntitySet(ast.resourcePath.entitySetName).getEntityType();
    let entity = this.entityReader.fromJson(body, type);
    this.repository.insertEntity(entity, type, result => {
      cb(result);
    });
  }

  public setSchema(schm: schema.Schema) {
    this.schema = schm;
  }
}
