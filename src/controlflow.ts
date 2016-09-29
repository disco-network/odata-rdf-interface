export function shouldNotBeReached(value: never, message: string) {
  throw new ShouldNotBeReachedError(message);
}

export class ShouldNotBeReachedError extends Error {
}
