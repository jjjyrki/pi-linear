export class NotImplementedError extends Error {
  constructor(feature: string) {
    super(`Linear extension placeholder: ${feature} is not implemented yet.`);
    this.name = 'NotImplementedError';
  }
}

export class LinearConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LinearConfigurationError';
  }
}

export class LinearValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LinearValidationError';
  }
}

export class LinearNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LinearNotFoundError';
  }
}

export function createNotImplementedError(feature: string): NotImplementedError {
  return new NotImplementedError(feature);
}
