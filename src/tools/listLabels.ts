import { defineTool } from '@mariozechner/pi-coding-agent';
import { Type } from '@mariozechner/pi-ai';

import { getLinearClient } from '../client.js';
import { LinearValidationError } from '../errors.js';
import { normalizeDiscoveryLabel, normalizePageInfo, type NormalizedLabel } from '../linear/shared.js';
import { validatePaginationFirst } from '../validation.js';
import { formatLabelLine } from './format.js';

const listLabelsSchema = Type.Object({
  teamId: Type.Optional(Type.String()),
  query: Type.Optional(Type.String()),
  first: Type.Optional(Type.Number()),
  after: Type.Optional(Type.String()),
});

export async function listLinearLabels(input: Record<string, unknown>): Promise<{ labels: NormalizedLabel[]; pageInfo: ReturnType<typeof normalizePageInfo> }> {
  const first = validatePaginationFirst(input.first, { defaultValue: 25, maxValue: 100 });
  const after = optionalString(input.after, 'after');
  const teamId = optionalString(input.teamId, 'teamId');
  const query = optionalQuery(input.query);

  const filter: Record<string, unknown> = {};
  if (teamId) {
    filter.team = { id: { eq: teamId } };
  }
  if (query) {
    filter.name = { containsIgnoreCase: query };
  }

  const connection = await getLinearClient().issueLabels({
    first,
    after,
    ...(Object.keys(filter).length > 0 ? { filter } : {}),
  } as never);

  return {
    labels: (connection.nodes ?? []).map(normalizeDiscoveryLabel),
    pageInfo: normalizePageInfo(connection.pageInfo),
  };
}

export const linearListLabelsTool = defineTool({
  name: 'linear_list_labels',
  label: 'List Labels',
  description: 'List Linear issue labels so agents can discover label IDs for create and update.',
  promptSnippet: 'List labels',
  promptGuidelines: ['Use linear_list_labels before setting labelIds on create or update.'],
  parameters: listLabelsSchema,
  async execute(_toolCallId, input) {
    const result = await listLinearLabels(input as Record<string, unknown>);
    const heading = typeof input.query === 'string' && input.query.trim().length > 0
      ? `Found ${result.labels.length} labels matching "${input.query.trim()}":`
      : `Found ${result.labels.length} labels:`;
    const labelLines = result.labels.map(formatLabelLine);
    const text = labelLines.length > 0 ? [heading, ...labelLines].join('\n') : heading.slice(0, -1);

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
