import { Schema } from "../../src/odata/schema";

export const uuidKeySchema = new Schema({
  entityTypes: {
    Entity: {
      properties: {
        Id: { type: "Edm.Guid", rdfName: "id", generated: "uuid" },
      },
      rdfName: "entity",
    },
  },
  entitySets: {
    Entities: { type: "Entity" },
  },
  defaultNamespace: {
    prefix: "disco",
    uri: "http://disco-network.org/resource/",
  },
});

export const autoIncrementSchema = new Schema({
  entityTypes: {
    Entity: {
      properties: {
        Id: { type: "Edm.Int32", rdfName: "id", generated: "auto-increment", autoIncrement_nextValue: 1 },
      },
      rdfName: "entity",
    },
  },
  entitySets: {
    Entities: { type: "Entity" },
  },
  defaultNamespace: {
    prefix: "disco",
    uri: "http://disco-network.org/resource/",
  },
});

export const diverselyTypedSchema = new Schema({
  entityTypes: {
    Entity: {
      properties: {
        String: { type: "Edm.String", optional: true, rdfName: "string" },
        Int32: { type: "Edm.Int32", optional: true, rdfName: "int32" },
        Uuid: { type: "Edm.Uuid", optional: true, rdfName: "uuid" },
      },
      rdfName: "entity",
    },
  },
  entitySets: {
    Entities: { type: "Entity" },
  },
  defaultNamespace: {
    prefix: "disco",
    uri: "http://disco-network.org/resource/",
  },
});

export const schemaWithMandatoryProperty = new Schema({
  entityTypes: {
    Entity: {
      properties: {
        Id: { type: "Edm.Guid", generated: "uuid", rdfName: "id" },
        Value: { type: "Edm.String", rdfName: "value" },
      },
      rdfName: "entity",
    },
  },
  entitySets: {
    Entities: { type: "Entity" },
  },
  defaultNamespace: {
    prefix: "disco",
    uri: "http://disco-network.org/resource/",
  },
});

export const schemaWithInverseProperty = new Schema({
  entityTypes: {
    Integer: {
      properties: {
        Id: { type: "Edm.Int32", rdfName: "value" },
        NextInteger: { type: "Integer", rdfName: "next", optional: true },
        PrevInteger: {
          type: "Integer", foreignSet: "Integers", inverseProperty: "NextInteger", optional: true },
        Prev: { type: "Edm.Int32", foreignProperty: "PrevInteger" },
        Next: { type: "Edm.Int32", foreignProperty: "NextInteger" },
      },
      rdfName: "integer",
    },
  },
  entitySets: {
    Integers: { type: "Integer" },
  },
  defaultNamespace: {
    prefix: "disco",
    uri: "http://disco-network.org/resource/",
  },
});
