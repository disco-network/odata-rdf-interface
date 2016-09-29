import { assert, assertEx, match } from "../src/assert";
import { uuidKeySchema, autoIncrementSchema, diverselyTypedSchema,
  schemaWithMandatoryProperty } from "./helpers/schemata";
import { EdmConverter } from "../src/odata/edm";

import base = require("../src/odata/entityreader");
import queryTestCases = require("./helpers/querytestcases");

describe("OData.EntityInitializer:", () => {

  queryTestCases.entityReaderTests.forEach(
    (args, i) => spec(`#${i}`, args)
  );

  function spec(name: string, args: queryTestCases.IEntityReaderTestCase) {
    it(name, () => {
      const entityInitializer = create();

      const entity = entityInitializer.fromParsed(args.input, args.type);

      assertEx.deepEqual(entity, args.outputEntity);
    });
  }

  it("should generate UUIDs", () => {
    const schema = uuidKeySchema;
    const entityInitializer = create();

    const entity = entityInitializer.fromParsed({}, schema.getEntityType("Entity"));

    let id: any = undefined;
    function isSameId(val) {
      if (id === undefined) {
        id = val;
        return true;
      }
      else return id === val;
    }
    assertEx.deepEqual(entity, [{
      type: "insert",
      entityType: "Entity",
      identifier: match.is(isSameId),
      value: {
        Id: { type: "Edm.Guid", value: match.is(isSameId) },
      },
    }]);
  });

  it("should overwrite user-defined properties which should be generated UUIDs", () => {
    const entity = create().fromParsed({
      Id: { type: "Edm.String", value: "[user-defined]" },
    }, uuidKeySchema.getEntityType("Entity"));

    assertEx.deepEqual(entity, [{
      type: "insert",
      entityType: "Entity",
      identifier: match.is(val => val !== "[user-defined]"),
      value: {
        Id: match.is(val => val !== "[user-defined]"),
      },
    }]);
  });

  it("should overwrite user-defined properties which should be auto-incremented", () => {
    const entity = create().fromParsed({
      Id: { type: "Edm.String", value: "[user-defined]" },
    }, autoIncrementSchema.getEntityType("Entity"));

    assertEx.deepEqual(entity, [{
      type: "insert",
      entityType: "Entity",
      identifier: match.any,
      value: {
        Id: match.is(val => val !== "[user-defined]"),
      },
    }]);
  });

  it("should throw a BadBodyError when a mandatory property is null", () => {
    try {
      create().fromParsed({
        Value: { type: "null", value: null },
      }, schemaWithMandatoryProperty.getEntityType("Entity"));
    }
    catch (e) {
      assert.strictEqual(e instanceof base.BadBodyError, true);
      return;
    }
    assert.strictEqual("no exception", "exception");
  });

  it("should throw a BadBodyError when a mandatory property is unspecified", () => {
    try {
      create().fromParsed({}, schemaWithMandatoryProperty.getEntityType("Entity"));
    }
    catch (e) {
      assert.strictEqual(e instanceof base.BadBodyError, true);
      return;
    }
    assert.strictEqual("no exception", "exception");
  });

  it("should throw when the value is incompatible with the property type", () => {
    assert.throws(() => create().fromParsed({
      Int32: { type: "Edm.String", value: "two" },
    }, diverselyTypedSchema.getEntityType("Entity")));
  });

  xit("should throw when the generated value is incompatible with the property type");
});

function create() {
  return new base.EntityInitializer(new EdmConverter());
}
