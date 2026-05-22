import {
  AuthenticationLinearError,
  FeatureNotAccessibleLinearError,
  ForbiddenLinearError,
  LinearError,
  NetworkLinearError,
  RatelimitedLinearError,
  UsageLimitExceededLinearError,
  parseLinearError,
} from '@linear/sdk';

import {
  LinearAuthenticationError,
  LinearConfigurationError,
  LinearNetworkError,
  LinearNotFoundError,
  LinearPermissionError,
  LinearRateLimitError,
  LinearValidationError,
} from '../errors.js';

export type LinearApiKeyState = 'missing' | 'blank' | 'configured';

export type LinearStatusFailureCategory =
  | 'invalid_key'
  | 'permission'
  | 'rate_limit'
  | 'network'
  | 'unknown';

const LIN_API_KEY_PATTERN = /\blin_api_[A-Za-z0-9]+\b/g;
const BEARER_TOKEN_PATTERN = /\bBearer\s+[A-Za-z0-9._-]+\b/gi;

export function getLinearApiKeyState(env: NodeJS.ProcessEnv = process.env): LinearApiKeyState {
  const raw = env.LINEAR_API_KEY;
  if (raw === undefined || raw === '') {
    return 'missing';
  }
  if (!raw.trim()) {
    return 'blank';
  }
  return 'configured';
}

export function collectRedactionSecrets(env: NodeJS.ProcessEnv = process.env): string[] {
  const secrets: string[] = [];
  const apiKey = env.LINEAR_API_KEY?.trim();
  if (apiKey) {
    secrets.push(apiKey);
  }
  return secrets;
}

export function redactSecrets(text: string, secrets: string[] = collectRedactionSecrets()): string {
  let result = text;
  for (const secret of secrets) {
    if (secret.length >= 4) {
      result = result.split(secret).join('[REDACTED]');
    }
  }
  return result.replace(LIN_API_KEY_PATTERN, '[REDACTED]').replace(BEARER_TOKEN_PATTERN, 'Bearer [REDACTED]');
}

export function formatSafeErrorMessage(
  error: unknown,
  options?: { operation?: string; secrets?: string[] },
): string {
  return redactSecrets(getUnsafeErrorMessage(normalizeLinearApiError(error, options?.operation)), options?.secrets);
}

function getUnsafeErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }
  if (typeof error === 'string' && error.trim().length > 0) {
    return error;
  }
  return 'unknown error';
}

function withOperationPrefix(operation: string | undefined, message: string): string {
  if (!operation) {
    return message;
  }
  return `${operation}: ${message}`;
}

function isNotFoundLinearError(linearError: LinearError, message: string): boolean {
  if (linearError.status === 404) {
    return true;
  }
  return /\bnot found\b/i.test(message);
}

function isNetworkLikeError(error: unknown, linearError?: LinearError): boolean {
  if (linearError instanceof NetworkLinearError) {
    return true;
  }
  if (error instanceof TypeError) {
    return true;
  }
  const code = (error as NodeJS.ErrnoException | undefined)?.code;
  return code === 'ENOTFOUND' || code === 'ECONNREFUSED' || code === 'ETIMEDOUT' || code === 'EAI_AGAIN';
}

export function normalizeLinearApiError(error: unknown, operation?: string): Error {
  if (
    error instanceof LinearConfigurationError
    || error instanceof LinearValidationError
    || error instanceof LinearNotFoundError
    || error instanceof LinearAuthenticationError
    || error instanceof LinearPermissionError
    || error instanceof LinearRateLimitError
    || error instanceof LinearNetworkError
  ) {
    return error;
  }

  const linearError = error instanceof LinearError ? error : parseLinearError(error as never);
  const baseMessage = pickLinearErrorMessage(linearError, error);

  if (linearError instanceof AuthenticationLinearError || linearError.status === 401) {
    return new LinearAuthenticationError(
      withOperationPrefix(
        operation,
        'Linear rejected the API key. Create a new personal API key in Linear settings and update LINEAR_API_KEY.',
      ),
    );
  }

  if (
    linearError instanceof ForbiddenLinearError
    || linearError instanceof FeatureNotAccessibleLinearError
    || linearError.status === 403
  ) {
    return new LinearPermissionError(
      withOperationPrefix(
        operation,
        'Linear denied access for this API key. Confirm the key belongs to the expected workspace and has the needed permissions.',
      ),
    );
  }

  if (linearError instanceof RatelimitedLinearError || linearError instanceof UsageLimitExceededLinearError || linearError.status === 429) {
    const retryHint =
      linearError instanceof RatelimitedLinearError && linearError.retryAfter
        ? ` Retry after about ${linearError.retryAfter} seconds.`
        : '';
    return new LinearRateLimitError(
      withOperationPrefix(operation, `Linear rate limit reached.${retryHint}`.trim()),
    );
  }

  if (isNotFoundLinearError(linearError, baseMessage)) {
    return new LinearNotFoundError(withOperationPrefix(operation, redactSecrets(baseMessage)));
  }

  if (isNetworkLikeError(error, linearError)) {
    return new LinearNetworkError(
      withOperationPrefix(operation, 'Could not reach Linear. Check network connectivity and try again.'),
    );
  }

  return new Error(withOperationPrefix(operation, redactSecrets(baseMessage)));
}

function pickLinearErrorMessage(linearError: LinearError, originalError: unknown): string {
  const graphqlMessage = linearError.errors?.find((entry) => entry.message.trim().length > 0)?.message;
  if (graphqlMessage) {
    return graphqlMessage;
  }
  if (linearError.message.trim().length > 0) {
    return linearError.message;
  }
  if (originalError instanceof Error && originalError.message.trim().length > 0) {
    return originalError.message;
  }
  return 'Linear request failed.';
}

export function classifyLinearStatusFailure(error: unknown): LinearStatusFailureCategory {
  const normalized = normalizeLinearApiError(error);
  if (normalized instanceof LinearAuthenticationError) {
    return 'invalid_key';
  }
  if (normalized instanceof LinearPermissionError) {
    return 'permission';
  }
  if (normalized instanceof LinearRateLimitError) {
    return 'rate_limit';
  }
  if (normalized instanceof LinearNetworkError) {
    return 'network';
  }
  return 'unknown';
}

export function describeLinearStatusFailure(category: LinearStatusFailureCategory): string {
  switch (category) {
    case 'invalid_key':
      return 'Linear rejected the API key. Create a new personal API key in Linear settings and update LINEAR_API_KEY.';
    case 'permission':
      return 'Linear denied access for this API key. Confirm workspace membership and permissions for the key.';
    case 'rate_limit':
      return 'Linear rate limit reached. Wait and try /linear-status again.';
    case 'network':
      return 'Could not reach Linear. Check network connectivity and try again.';
    default:
      return 'Linear authentication check failed for an unknown reason.';
  }
}

export async function withLinearOperation<T>(operation: string, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    throw normalizeLinearApiError(error, operation);
  }
}
