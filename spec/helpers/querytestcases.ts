import schema = require("../../src/odata/schema");

let queries = [
  "/Posts",
  "/Content",
];

let parsedEntities = [
  {
    ContentId: "1",
  },
  {
    Title: "MyContent",
  },
];

let jsonStrings = parsedEntities.map(e => JSON.stringify(e));

let asts = [
  {
    type: "resourceQuery",
    resourcePath: {
      type: "entitySet",
      entitySetName: "Posts",
      navigation: { type: "none" },
    },
    queryOptions: {},
  },
  {
    type: "resourceQuery",
    resourcePath: {
      type: "entitySet",
      entitySetName: "Content",
    },
  },
];

let entities = [
  {
    Id: "3",
    ContentId: "1",
  },
  {
    Id: "3",
    Title: "MyContent",
  },
];

let entitySetNames = [
  "Posts", "Content",
];

let types = entitySetNames.map(set => new schema.Schema().getEntitySet(set).getEntityType());

let sparqlStrings = [
  "PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> " +
      "PREFIX disco: <http://disco-network.org/resource/> " +
      "INSERT DATA { ?x0 rdf:type disco:Post . ?x0 disco:id '3' . ?x0 disco:content ?x1 } WHERE { ?x1 disco:id '1' }",
  "PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> " +
      "PREFIX disco: <http://disco-network.org/resource/> " +
      "INSERT DATA { ?x0 rdf:type disco:Content . ?x0 disco:id '3' . ?x0 disco:title 'MyContent' }",
];

export let postQueryTests: IPostQueryTestCase[] = [
  { query: queries[0], body: jsonStrings[0], entity: entities[0], entityType: types[0],
    sparql: sparqlStrings[0], parsedEntity: parsedEntities[0], entitySetName: entitySetNames[0] },
  { query: queries[1], body: jsonStrings[1], entity: entities[1], entityType: types[1],
    sparql: sparqlStrings[1], parsedEntity: parsedEntities[1], entitySetName: entitySetNames[1] },
];

export let odataRepositoryQueryTests: IODataRepositoryTestCase[] = [
  { entity: entities[0], entityType: types[0], sparql: sparqlStrings[0] },
];

export let odataParserTests: IPostRequestParserTestCase[] = [
  { query: queries[0], body: jsonStrings[0], parsedEntity: entities[0], entitySetName: entitySetNames[0] },
];

export let entityReaderTests: IEntityReaderTestCase[] = [
  { input: parsedEntities[0], type: types[0], outputEntity: entities[0] },
];

export interface IPostQueryTestCase {
  query: string; body: string; entity: any; entityType: schema.EntityType; sparql: string;
  parsedEntity: any; entitySetName: string;
}

export interface IPostRequestParserTestCase {
  query: string; body: string; parsedEntity: any; entitySetName: string;
}

export interface IODataRepositoryTestCase {
  entity: any; entityType: schema.EntityType; sparql: string;
}

export interface IEntityReaderTestCase {
  input: any; type: schema.EntityType; outputEntity: any;
}
