import { assertEx } from "../src/assert";

import base = require("../src/odata/entityreader");
import queryTestCases = require("./helpers/querytestcases");

describe("OData.EntityInitializer", () => {

  queryTestCases.entityReaderTests.forEach(
    (args, i) => spec(`#${i}`, args)
  );

  function spec(name: string, args: queryTestCases.IEntityReaderTestCase) {
    it(name, () => {
      let entityReader = create();

      let entity = entityReader.fromParsed(args.input, args.type);

      assertEx.deepEqual(entity, args.outputEntity);
    });
  }
});

function create() {
  return new base.EntityInitializer();
}
