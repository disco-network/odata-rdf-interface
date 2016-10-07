export function shouldNotBeReached(value: never, message: string): never {
  throw new ShouldNotBeReachedError(message);
}

export class ShouldNotBeReachedError extends Error {
}
