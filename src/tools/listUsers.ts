import { defineTool } from '@mariozechner/pi-coding-agent';
import { Type } from '@mariozechner/pi-ai';

import { getLinearClient } from '../client.js';
import { LinearValidationError } from '../errors.js';
import { normalizeDiscoveryUser, normalizePageInfo, type NormalizedUser } from '../linear/shared.js';
import { validatePaginationFirst } from '../validation.js';
import { formatUserLine } from './format.js';

const listUsersSchema = Type.Object({
  query: Type.Optional(Type.String()),
  first: Type.Optional(Type.Number()),
  after: Type.Optional(Type.String()),
});

export async function listLinearUsers(input: Record<string, unknown>): Promise<{ users: NormalizedUser[]; pageInfo: ReturnType<typeof normalizePageInfo> }> {
  const first = validatePaginationFirst(input.first, { defaultValue: 25, maxValue: 100 });
  const after = optionalString(input.after, 'after');
  const query = optionalQuery(input.query);
  const connection = await getLinearClient().users({ ...(query ? { query } : {}), first, after } as never);

  return {
    users: (connection.nodes ?? []).map((user) => normalizeDiscoveryUser(user)),
    pageInfo: normalizePageInfo(connection.pageInfo),
  };
}

export const linearListUsersTool = defineTool({
  name: 'linear_list_users',
  label: 'List Users',
  description: 'List Linear users so agents can discover assignee IDs.',
  promptSnippet: 'List users',
  promptGuidelines: ['Use linear_list_users when assigneeId is unknown.'],
  parameters: listUsersSchema,
  async execute(_toolCallId, input) {
    const result = await listLinearUsers(input as Record<string, unknown>);
    const heading = typeof input.query === 'string' && input.query.trim().length > 0
      ? `Found ${result.users.length} users matching "${input.query.trim()}":`
      : `Found ${result.users.length} users:`;
    const userLines = result.users.map(formatUserLine);
    const text = userLines.length > 0 ? [heading, ...userLines].join('\n') : heading.slice(0, -1);

    return {
      content: [{ type: 'text', text }],
      details: result,
    };
  },
});

function optionalString(value: unknown, fieldName: string): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new LinearValidationError(`${fieldName} must be a non-empty string when provided.`);
  }
  return value;
}

function optionalQuery(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new LinearValidationError('query must be a non-empty string when provided.');
  }
  return value.trim();
}
