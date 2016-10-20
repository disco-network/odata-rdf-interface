import { assert } from "chai";
import openArgs = require("../src/adapter/openargs");

describe("OpenArgs:", () => {
  it("set Contracts and create children", () => {
    let value = "";
    let args = new openArgs.OpenArgs();
    args.set(IContract, new Contract("a", v => value = v));
    assert.strictEqual(value, "a");
    args.createChild().set(Contract, new Contract("b", v => value = v));
    assert.strictEqual(value, "a/b");
  });

  it("get Contracts set before", () => {
    let args = new openArgs.OpenArgs().set(IContract, new Contract("c", () => undefined));
    assert.strictEqual(args.get(IContract).getValue(), "c");
  });
});

describe("OpenArgsCompatibilityChecker:", () => {

  it("perform a check", () => {
    let args = new openArgs.OpenArgs();
    args.set(IContract, new Contract("contract 1", v => undefined));
    let args2 = new openArgs.OpenArgs();
    args2.set(IContract, new Contract("contract 2", v => undefined));

    let checker = new openArgs.OpenArgsCompatibilityChecker();
    checker.setDefaultCondition(IContract, c => c.getValue() === "contract 1");

    assert.strictEqual(checker.checkCompatibility(args, []), true);
    assert.strictEqual(checker.checkCompatibility(args2, []), false);
    assert.strictEqual(checker.checkCompatibility(args2, [IContract]), true);
  });

  it("throw when assigning a default condition twice", () => {
    let checker = new openArgs.OpenArgsCompatibilityChecker();
    checker.setDefaultCondition(IContract, c => c.getValue() === "contract 1");
    assert.throws(() => checker.setDefaultCondition(IContract, c => c.getValue() === "contract 2"));
  });
});

let IContract = openArgs.defContract(null as any as Contract);

interface ContractGetter extends openArgs.IArgsGetter<Contract, ContractGetter> {}
class Contract implements openArgs.IContractImplementer<ContractGetter> {

  constructor(private value: string, private output: (value: string) => void) {}

  public initializeWithPreviousArgs(args: openArgs.IOpenArgsReadonly<ContractGetter>) {
    let parent = args && args.get(IContract);
    if (parent) {
      this.value = parent.getValue() + "/" + this.value;
    }
    this.output(this.value);
  }

  public getValue() {
    return this.value;
  }
}
