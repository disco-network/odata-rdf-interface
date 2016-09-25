import { assertEx, match } from "../src/assert";
import { uuidKeySchema, autoIncrementSchema } from "./helpers/schemata";

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
        Id: match.is(isSameId),
      },
    }]);
  });

  it("should overwrite user-defined properties which should be generated UUIDs", () => {
    const entity = create().fromParsed({ Id: "[user-defined]" }, uuidKeySchema.getEntityType("Entity"));

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
    const entity = create().fromParsed({ Id: "[user-defined]" }, autoIncrementSchema.getEntityType("Entity"));

    assertEx.deepEqual(entity, [{
      type: "insert",
      entityType: "Entity",
      identifier: match.any,
      value: {
        Id: match.is(val => val !== "[user-defined]"),
      },
    }]);
  });

  xit("should throw when the generated value doesn't match the property type");
});

function create() {
  return new base.EntityInitializer();
}
