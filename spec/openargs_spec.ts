import openArgs = require("../src/adapter/openargs");

describe("OpenArgs:", () => {
  it("", () => {
    let value = "";
    let args = new openArgs.OpenArgsImpl();
    args.set(Contract, new Contract("a", v => value = v));
    expect(value).toBe("a");
    args.createChild().set(Contract, new Contract("b", v => value = v));
    expect(value).toBe("a/b");
  });
});

class Contract implements openArgs.ContractImplementer {

  public static methodWithContractImplementerReturnType(): Contract { return null; }

  constructor(private value: string, private output: (value: string) => void) {}

  public initializeWithPreviousArgs(args: openArgs.OpenArgsReadonly) {
    let parent = args && args.get(Contract);
    if (parent) {
      this.value = parent.getValue() + "/" + this.value;
    }
    this.output(this.value);
  }

  public getValue() {
    return this.value;
  }
}
