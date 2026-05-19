import { LinearClient } from '@linear/sdk';

import { LinearConfigurationError } from './errors.js';
import { getLinearApiKeyState } from './linear/errorHandling.js';
import { createLinearClientFromToken } from './linear/shared.js';

let cachedLinearClient: LinearClient | undefined;

function missingApiKeyMessage(state: ReturnType<typeof getLinearApiKeyState>): string {
  if (state === 'blank') {
    return 'LINEAR_API_KEY is set but empty. Set a valid API key to use Linear tools.';
  }
  return 'Set LINEAR_API_KEY to use Linear tools.';
}

export function createLinearClient(env: NodeJS.ProcessEnv = process.env): LinearClient {
  const apiKeyState = getLinearApiKeyState(env);
  if (apiKeyState !== 'configured') {
    throw new LinearConfigurationError(missingApiKeyMessage(apiKeyState));
  }

  return createLinearClientFromToken(env.LINEAR_API_KEY ?? '');
}

export function getLinearClient(env: NodeJS.ProcessEnv = process.env): LinearClient {
  if (!cachedLinearClient) {
    cachedLinearClient = createLinearClient(env);
  }

  return cachedLinearClient;
}

export function resetLinearClientCache(): void {
  cachedLinearClient = undefined;
}
