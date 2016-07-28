export class Result<Result, Error> {

  public static success<Result>(res: Result) {
    return new Result<Result, any>(res);
  }

  public static error<Error>(err: Error) {
    return new Result<any, Error>(null, err);
  }

  constructor(private res: Result, private err?: Error) {
  }

  public success() {
    return this.err === undefined;
  }

  public error() {
    return this.err;
  }

  public result() {
    return this.res;
  }
}

export let AnyResult = Result;
export type AnyResult = Result<any, any>;
