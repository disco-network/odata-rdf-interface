import { assert } from "chai";

import base = require("../src/odata/entityreader");
import queryTestCases = require("./helpers/querytestcases");

describe("OData.EntityReader", () => {
  queryTestCases.entityReaderTests.forEach(
    (args, i) => spec(`#${i}`, args)
  );

  function spec(name: string, args: queryTestCases.IEntityReaderTestCase) {
    it(name, () => {
      let entityReader = create();

      let entity = entityReader.fromJson(args.input, args.type);

      assert.deepEqual(entity, args.outputEntity);
    });
  }
});

function create() {
  return new base.EntityReader();
}
