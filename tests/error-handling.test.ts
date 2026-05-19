import { jest } from '@jest/globals';
import {
  AuthenticationLinearError,
  ForbiddenLinearError,
  LinearError,
  NetworkLinearError,
  RatelimitedLinearError,
} from '@linear/sdk';

import {
  LinearAuthenticationError,
  LinearConfigurationError,
  LinearNetworkError,
  LinearPermissionError,
  LinearRateLimitError,
} from '../src/errors.js';
import {
  classifyLinearStatusFailure,
  collectRedactionSecrets,
  describeLinearStatusFailure,
  formatSafeErrorMessage,
  getLinearApiKeyState,
  normalizeLinearApiError,
  redactSecrets,
  withLinearOperation,
} from '../src/linear/errorHandling.js';

const SECRET = 'lin_api_supersecret123';

describe('linear error handling', () => {
  const originalApiKey = process.env.LINEAR_API_KEY;

  beforeEach(() => {
    process.env.LINEAR_API_KEY = SECRET;
  });

  afterEach(() => {
    if (originalApiKey === undefined) {
      delete process.env.LINEAR_API_KEY;
    } else {
      process.env.LINEAR_API_KEY = originalApiKey;
    }
  });

  it('detects missing, blank, and configured API key states', () => {
    delete process.env.LINEAR_API_KEY;
    expect(getLinearApiKeyState()).toBe('missing');

    process.env.LINEAR_API_KEY = '   ';
    expect(getLinearApiKeyState()).toBe('blank');

    process.env.LINEAR_API_KEY = SECRET;
    expect(getLinearApiKeyState()).toBe('configured');
  });

  it('redacts configured keys and common token patterns', () => {
    const secrets = collectRedactionSecrets();
    expect(redactSecrets(`Authorization: Bearer ${SECRET}`, secrets)).not.toContain(SECRET);
    expect(redactSecrets('failed with lin_api_leakedtoken', secrets)).toBe('failed with [REDACTED]');
    expect(redactSecrets(`key=${SECRET} done`, secrets)).toBe('key=[REDACTED] done');
  });

  it('normalizes authentication, permission, rate-limit, and network SDK errors', () => {
    const auth = normalizeLinearApiError(new AuthenticationLinearError({} as never, []), 'linear_viewer');
    expect(auth).toBeInstanceOf(LinearAuthenticationError);
    expect(auth.message).toContain('linear_viewer:');
    expect(auth.message).not.toContain(SECRET);

    const permission = normalizeLinearApiError(new ForbiddenLinearError({} as never, []), 'linear_list_teams');
    expect(permission).toBeInstanceOf(LinearPermissionError);
    expect(permission.message).toContain('linear_list_teams:');

    const rateLimit = normalizeLinearApiError(
      new RatelimitedLinearError({ response: { headers: new Map([['retry-after', '30']]) } } as never, []),
      'linear_list_issues',
    );
    expect(rateLimit).toBeInstanceOf(LinearRateLimitError);
    expect(rateLimit.message).toContain('rate limit');

    const network = normalizeLinearApiError(new NetworkLinearError({} as never, []), 'linear_read_issue');
    expect(network).toBeInstanceOf(LinearNetworkError);
    expect(network.message).toContain('Could not reach Linear');
  });

  it('redacts secrets from generic SDK error messages', () => {
    const raw = new LinearError(
      { message: `Invalid token ${SECRET}` } as never,
      [{ message: `still contains ${SECRET}` } as never],
    );
    const normalized = normalizeLinearApiError(raw, 'linear_viewer');
    expect(normalized.message).not.toContain(SECRET);
    expect(normalized.message).toContain('[REDACTED]');
  });

  it('maps status failures to actionable /linear-status categories', () => {
    expect(
      classifyLinearStatusFailure(new AuthenticationLinearError({} as never, [])),
    ).toBe('invalid_key');
    expect(describeLinearStatusFailure('invalid_key')).toContain('rejected the API key');
    expect(describeLinearStatusFailure('network')).toContain('Could not reach Linear');
  });

  it('wraps operations and preserves configuration errors', async () => {
    await expect(
      withLinearOperation('linear_viewer', async () => {
        throw new LinearConfigurationError('Set LINEAR_API_KEY to use Linear tools.');
      }),
    ).rejects.toThrow(LinearConfigurationError);

    await expect(
      withLinearOperation('linear_viewer', async () => {
        throw new AuthenticationLinearError({ message: SECRET } as never, [{ message: SECRET } as never]);
      }),
    ).rejects.toMatchObject({
      name: 'LinearAuthenticationError',
      message: expect.not.stringContaining(SECRET),
    });
  });

  it('formats safe error messages for bulk helpers without leaking tokens', () => {
    const message = formatSafeErrorMessage(
      new Error(`request failed for ${SECRET}`),
      { operation: 'linear_create_issues', secrets: [SECRET] },
    );
    expect(message).toContain('linear_create_issues:');
    expect(message).not.toContain(SECRET);
  });
});
