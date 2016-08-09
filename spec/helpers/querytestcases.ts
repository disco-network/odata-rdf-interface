import schema = require("../../src/odata/schema");

let queries = [
  "/Posts",
  "/Content",
];

let jsonStrings = [
  JSON.stringify({
    ContentId: "1",
  }),
  JSON.stringify({
    Title: "MyContent",
  }),
];

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

let types = [
  new schema.Schema().getEntityType("Post"),
  new schema.Schema().getEntityType("Content"),
];

let sparqlStrings = [
  "PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> " +
      "PREFIX disco: <http://disco-network.org/resource/> " +
      "INSERT DATA { ?x0 rdf:type disco:Post . ?x0 disco:id '3' . ?x0 disco:content ?x1 } WHERE { ?x1 disco:id '1' }",
  "PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> " +
      "PREFIX disco: <http://disco-network.org/resource/> " +
      "INSERT DATA { ?x0 rdf:type disco:Content . ?x0 disco:id '3' . ?x0 disco:title 'MyContent' }",
];

export let postQueryTests: IPostQueryTestCase[] = [
  { query: queries[0], body: jsonStrings[0], ast: asts[0], entity: entities[0], entityType: types[0],
    sparql: sparqlStrings[0] },
  { query: queries[1], body: jsonStrings[1], ast: asts[1], entity: entities[1], entityType: types[1],
    sparql: sparqlStrings[1] },
];

export let odataRepositoryQueryTests: IODataRepositoryTestCase[] = [
  { entity: entities[0], entityType: types[0], sparql: sparqlStrings[0] },
];

export let odataParserTests: IODataParserTestCase[] = [
  { query: queries[0], ast: asts[0] },
];

export let entityReaderTests: IEntityReaderTestCase[] = [
  { input: jsonStrings[0], type: types[0], outputEntity: entities[0] },
];

export interface IPostQueryTestCase {
  query: string; body: string; ast: any; entity: any; entityType: schema.EntityType; sparql: string;
}

export interface IODataParserTestCase {
  query: string; ast: any;
}

export interface IODataRepositoryTestCase {
  entity: any; entityType: schema.EntityType; sparql: string;
}

export interface IEntityReaderTestCase {
  input: string; type: schema.EntityType; outputEntity: any;
}
