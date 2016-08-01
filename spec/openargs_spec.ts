import openArgs = require("../src/adapter/openargs");

describe("OpenArgsImpl:", () => {
  it("get / set Contracts and create children", () => {
    let value = "";
    let args = new openArgs.OpenArgsImpl();
    args.set(Contract, new Contract("a", v => value = v));
    expect(value).toBe("a");
    args.createChild().set(Contract, new Contract("b", v => value = v));
    expect(value).toBe("a/b");
  });
});

describe("OpenArgsCompatibilityCheckerImpl:", () => {

  it("perform a check", () => {
    let args = new openArgs.OpenArgsImpl();
    args.set(Contract, new Contract("contract 1", v => undefined));
    let args2 = new openArgs.OpenArgsImpl();
    args2.set(Contract, new Contract("contract 2", v => undefined));

    let checker = new openArgs.OpenArgsCompatibilityCheckerImpl();
    checker.setDefaultCondition(Contract, c => c.getValue() === "contract 1");

    expect(checker.checkCompatibility(args, [])).toBe(true);
    expect(checker.checkCompatibility(args2, [])).toBe(false);
    expect(checker.checkCompatibility(args2, [Contract])).toBe(true);
  });

  it("throw when assigning a default condition twice", () => {
    let checker = new openArgs.OpenArgsCompatibilityCheckerImpl();
    checker.setDefaultCondition(Contract, c => c.getValue() === "contract 1");
    expect(() => checker.setDefaultCondition(Contract, c => c.getValue() === "contract 2")).toThrow();
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
