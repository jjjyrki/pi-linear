import { LinearClient } from '@linear/sdk';

import { LinearConfigurationError } from './errors.js';
import { createLinearClientFromToken } from './linear/shared.js';

let cachedLinearClient: LinearClient | undefined;

export function createLinearClient(env: NodeJS.ProcessEnv = process.env): LinearClient {
  const apiKey = env.LINEAR_API_KEY;
  if (!apiKey) {
    throw new LinearConfigurationError('Set LINEAR_API_KEY to use Linear tools.');
  }

  return createLinearClientFromToken(apiKey);
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
