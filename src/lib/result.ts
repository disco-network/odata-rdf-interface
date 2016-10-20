export const Result = {

  success: <Res>(res: Res) => {
    return new SuccessfulResult<Res, any>(res);
  },

  error: <Error>(err: Error) => {
    return new FailedResult<any, Error>(err);
  },
};

export interface IResult<Res, Err> {
  success(): this is SuccessfulResult<Res, Err>;
  result(): Res | undefined;
  error(): Err | undefined;
  process<NewRes, NewErr>(success: (result: Res) => NewRes,
                          error: (err: Err) => NewErr): Result<NewRes, NewErr>;
}

export class SuccessfulResult<Res, Err> implements IResult<Res, Err> {

  constructor(private res: Res) {}

  public success(): this is SuccessfulResult<Res, Err> {
    return true;
  }

  public result(): Res {
    return this.res;
  }

  public error(): undefined {
    return undefined;
  }

  public process<NewRes, NewErr>(success: (result: Res) => NewRes,
                                 error: (err: Err) => NewErr): Result<NewRes, NewErr> {
    return Result.success(success(this.result()));
  };
}

export class FailedResult<Res, Err> implements IResult<Res, Err> {

  constructor(private err: Err) {}

  public success(): this is SuccessfulResult<Res, Err> {
    return false;
  }

  public error(): Err {
    return this.err;
  }

  public result(): undefined {
    return undefined;
  }

  public process<NewRes, NewErr>(success: (result: Res) => NewRes,
                                 error: (err: Err) => NewErr): Result<NewRes, NewErr> {
    return Result.error(error(this.error()));
  };
}

export type Result<Res, Err> = SuccessfulResult<Res, Err> | FailedResult<Res, Err>;
export let AnyResult = Result;
export type AnyResult = Result<any, any>;
