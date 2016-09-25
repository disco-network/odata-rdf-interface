import { Schema } from "../../src/odata/schema";

export const uuidKeySchema = new Schema({
  entityTypes: {
    Entity: {
      properties: {
        Id: { type: "Edm.Guid", rdfName: "id", generated: "uuid" },
        Text: { type: "Edm.String", rdfName: "text", nullable: false },
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
        Id: { type: "Edm.Int64", rdfName: "id", generated: "auto-increment", autoIncrement_nextValue: 1 },
        Text: { type: "Edm.String", rdfName: "text", nullable: false },
      },
    },
  },
  entitySets: {
    Entities: { type: "Entity" },
  },
});
