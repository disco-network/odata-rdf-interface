import openArgs = require("../src/adapter/openargs");

describe("OpenArgs:", () => {
  it("get / set Contracts and create children", () => {
    let value = "";
    let args = new openArgs.OpenArgs();
    args.set(Contract, new Contract("a", v => value = v));
    expect(value).toBe("a");
    args.createChild().set(Contract, new Contract("b", v => value = v));
    expect(value).toBe("a/b");
  });
});

describe("OpenArgsCompatibilityChecker:", () => {

  it("perform a check", () => {
    let args = new openArgs.OpenArgs();
    args.set(Contract, new Contract("contract 1", v => undefined));
    let args2 = new openArgs.OpenArgs();
    args2.set(Contract, new Contract("contract 2", v => undefined));

    let checker = new openArgs.OpenArgsCompatibilityChecker();
    checker.setDefaultCondition(Contract, c => c.getValue() === "contract 1");

    expect(checker.checkCompatibility(args, [])).toBe(true);
    expect(checker.checkCompatibility(args2, [])).toBe(false);
    expect(checker.checkCompatibility(args2, [Contract])).toBe(true);
  });

  it("throw when assigning a default condition twice", () => {
    let checker = new openArgs.OpenArgsCompatibilityChecker();
    checker.setDefaultCondition(Contract, c => c.getValue() === "contract 1");
    expect(() => checker.setDefaultCondition(Contract, c => c.getValue() === "contract 2")).toThrow();
  });
});

class Contract implements openArgs.IContractImplementer {

  public static methodWithContractImplementerReturnType(): Contract { return null; }

  constructor(private value: string, private output: (value: string) => void) {}

  public initializeWithPreviousArgs(args: openArgs.IOpenArgsReadonly) {
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
