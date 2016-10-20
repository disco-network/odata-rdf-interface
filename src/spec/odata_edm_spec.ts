import { assert } from "../lib/assert";
import { EdmConverter, IEdmConverter } from "../lib/odata/edm";

describe("EdmConverter:", () => {
  it("should convert Edm.String to Edm.Int32", () => {
    const converter = new EdmConverter();

    const result = converter.convert({ type: "Edm.String", value: "42" }, "Edm.Int32");

    assert.deepEqual(result, { type: "Edm.Int32", value: 42 });
  });

  it("should throw when converting a string that is no decimal number", () => {
    assert.throws(() => new EdmConverter().convert({ type: "Edm.String", value: "fourty-two" }, "Edm.Int32"));
  });

  it("should convert null to nullable types", () => {
    const converter: IEdmConverter = new EdmConverter();

    const result = converter.convert({ type: "null" }, "Edm.String", true);

    assert.deepEqual(result, { type: "null" });
  });

  it("should throw when converting null to non-nullable types", () => {
    const converter: IEdmConverter = new EdmConverter();

    assert.throws(() => converter.convert({ type: "null" }, "Edm.String"));
  });
});
