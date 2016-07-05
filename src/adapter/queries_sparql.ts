/** @module */
import mappings = require("./sparql_mappings");
import gpatterns = require("./sparql_graphpatterns");
import qsBuilder = require("./querystring_builder");
import ODataQueries = require("../odata/queries");

/**
 * @class
 * Used to generate query objects which can be run to modify and/or retrieve data.
 */
export class QueryFactory {
  constructor(private model: ODataQueries.QueryModel, private schema) { }
  public create(): ODataQueries.Query {
    return new EntitySetQuery(this.model, this.schema);
  }
}

/**
 * @namespace
 * @name EntitySetQuery
 * @description Handles read-only OData queries.
 */
export class EntitySetQuery implements ODataQueries.Query {
  private result: { error?: any, result?: any };
  constructor(private model: ODataQueries.QueryModel, private schema) { }

  public run(sparqlProvider, cb: () => void): void {
    let setSchema = this.schema.getEntitySet(this.model.entitySetName);
    let entityType = setSchema.getEntityType();

    let vargen = new mappings.SparqlVariableGenerator();
    let chosenEntityVar = vargen.next();

    let mapping = new mappings.StructuredSparqlVariableMapping(chosenEntityVar, vargen);
    let queryContext = new SparqlQueryContext(mapping, entityType, this.model.expandTree);
    let graphPattern = new gpatterns.ExpandTreeGraphPattern(entityType, this.model.expandTree, mapping);
    let evaluator = new ODataQueries.QueryResultEvaluator();

    // let triplePatterns = graphPattern.getTriples();

    let queryStringBuilder = new qsBuilder.QueryStringBuilder();
    queryStringBuilder.insertPrefix("rdf", "http://www.w3.org/1999/02/22-rdf-syntax-ns#");
    queryStringBuilder.insertPrefix("disco", "http://disco-network.org/resource/");
    let queryString = queryStringBuilder.fromGraphPattern(graphPattern);
    console.log(queryString);
    sparqlProvider.querySelect(queryString, answer => {
      if (!answer.error) {
        this.result = { result: answer.result.map(single => {
          let entity = evaluator.evaluate(single, queryContext);
          return entity;
        }) };
      }
      else {
        this.result = { error: answer.error };
      }
      cb();
    });
  }

  /** @method
   * @description Pass the results of the query to the HTTP result object
   */
  public sendResults(res): void {
    if (!this.result.error) {
      res.writeHeader(200, { "Content-type": "application/json" });
      res.end(JSON.stringify(this.result.result, null, 2));
    }
    else {
      handleErrors(this.result, res);
    }
  }
}

/** @class
 * This class provides methods to interpret a SPARQL query result as OData.
 */
export class SparqlQueryContext implements ODataQueries.QueryContext {
  private mapping: mappings.StructuredSparqlVariableMapping;
  private rootTypeSchema: any;
  private remainingExpandBranch: Object;

  constructor(mapping: mappings.StructuredSparqlVariableMapping, rootTypeSchema, remainingExpandBranch) {
    this.mapping = mapping;
    this.rootTypeSchema = rootTypeSchema;
    this.remainingExpandBranch = remainingExpandBranch;
  }

  public forEachElementaryPropertyOfResult(result, fn: (property: string, variable: string) => void): void {
    let self = this;
    this.mapping.forEachElementaryProperty(function(propertyName, variableName) {
      let obj = result[variableName.substr(1)];
      if (obj) fn(obj.value, self.rootTypeSchema.getProperty(propertyName));
    });
  }

  public forEachComplexPropertyOfResult(result, fn: (property: string,
      variable: mappings.StructuredSparqlVariableMapping) => void): void {
    for (let propertyName in this.remainingExpandBranch) {
      fn(result, this.rootTypeSchema.getProperty(propertyName));
    }
  }

  public forEachElementaryPropertySchema(fn: (property) => void): void {
    this.mapping.forEachComplexProperty(function(propertyName, variableName) {
      fn(this.rootTypeSchema.getProperty(propertyName));
    });
  }

  public forEachComplexPropertySchema(fn: (property) => void): void {
    for (let propertyName in this.remainingExpandBranch) {
      fn(this.rootTypeSchema.getProperty(propertyName));
    }
  }

  public getElementaryPropertyOfResult(result, propertyName: string): any {
    return result[this.mapping.getElementaryPropertyVariable(propertyName).substr(1)].value;
  }

  /** Return another context associated with a complex property. */
  public getSubContext(propertyName: string): SparqlQueryContext {
    /** @todo is it a good idea to create so many instances? */
    return new SparqlQueryContext(
      this.mapping.getComplexProperty(propertyName),
      this.rootTypeSchema.getProperty(propertyName).getEntityType(),
      this.remainingExpandBranch[propertyName]);
  }
}

/** Stores the query results of a SPARQL query to satisfy an OData request.
 * To the data belongs an object with the properties of quantity one and @construction 
 */

function handleErrors(result, res) {
  switch (result.error) {
    case ODataQueries.ErrorTypes.DB:
      res.statusCode = 500;
      res.end("database error " + result.errorDetails);
      break;
    default:
      res.statusCode = 500;
      console.log(result.error.stack);
      res.end("unknown error type " + result.error);
  }
}
