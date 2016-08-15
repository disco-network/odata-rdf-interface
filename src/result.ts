export class Result<Res, Err> {

  public static success<Res>(res: Res) {
    return new Result<Res, any>(res);
  }

  public static error<Error>(err: Error) {
    return new Result<any, Error>(null, err);
  }

  constructor(private res: Res, private err?: Err) {
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

  public process<NewRes, NewErr>(success: (result: Res) => NewRes,
                                 error: (err: Err) => NewErr): Result<NewRes, NewErr> {
    if (this.success()) return Result.success(success(this.result()));
    else return Result.error(error(this.error()));
  }
}

export let AnyResult = Result;
export type AnyResult = Result<any, any>;
