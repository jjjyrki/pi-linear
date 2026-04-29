export class NotImplementedError extends Error {
  constructor(feature: string) {
    super(`Linear extension placeholder: ${feature} is not implemented yet.`);
    this.name = 'NotImplementedError';
  }
}

export function createNotImplementedError(feature: string): NotImplementedError {
  return new NotImplementedError(feature);
}
