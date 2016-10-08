export function shouldNotBeReached(value: never, message: string): never {
  throw new ShouldNotBeReachedError(message);
}

export class ShouldNotBeReachedError extends Error {
}


export function tryCatch<T extends Function>(fn: T, catchFn: (e) => void) {
  return function () {
    try {
      return fn.apply(this, arguments);
    }
    catch (e) {
      catchFn(e);
    }
  } as any as T;
}
