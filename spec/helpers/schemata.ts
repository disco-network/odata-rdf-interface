import { Schema } from "../../src/odata/schema";

export const uuidKeySchema = new Schema({
  entityTypes: {
    Entity: {
      properties: {
        Id: { type: "Edm.Guid", rdfName: "id", generated: "uuid" },
      },
    },
  },
  entitySets: {
    Entities: { type: "Entity" },
  },
});

export const autoIncrementSchema = new Schema({
  entityTypes: {
    Entity: {
      properties: {
        Id: { type: "Edm.Int32", rdfName: "id", generated: "auto-increment", autoIncrement_nextValue: 1 },
      },
    },
  },
  entitySets: {
    Entities: { type: "Entity" },
  },
});

export const diverselyTypedSchema = new Schema({
  entityTypes: {
    Entity: {
      properties: {
        String: { type: "Edm.String" },
        Int32: { type: "Edm.Int32" },
        Uuid: { type: "Edm.Uuid" },
      },
    },
  },
  entitySets: {
    Entities: { type: "Entity" },
  },
});
