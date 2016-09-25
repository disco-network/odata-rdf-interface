import { assert } from "../src/assert";
import { EdmConverter } from "../src/odata/edm";

describe("EdmConverter:", () => {
  it("should convert Edm.String to Edm.Int32", () => {
    const converter = new EdmConverter();

    const result = converter.convert({ type: "Edm.String", value: "42" }, "Edm.Int32");

    assert.deepEqual(result, { type: "Edm.Int32", value: 42 });
  });

  it("should throw when converting a string that is no decimal number", () => {
    assert.throws(() => new EdmConverter().convert({ type: "Edm.String", value: "fourty-two" }, "Edm.Int32"));
  });
});
