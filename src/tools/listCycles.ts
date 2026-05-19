import { defineTool } from '@mariozechner/pi-coding-agent';
import { Type } from '@mariozechner/pi-ai';

import { getLinearClient } from '../client.js';
import { LinearValidationError } from '../errors.js';
import { normalizeDiscoveryCycle, normalizePageInfo, type NormalizedCycle } from '../linear/shared.js';
import { validatePaginationFirst } from '../validation.js';
import { formatCycleLine } from './format.js';

const listCyclesSchema = Type.Object({
  teamId: Type.Optional(Type.String()),
  first: Type.Optional(Type.Number()),
  after: Type.Optional(Type.String()),
});

export async function listLinearCycles(input: Record<string, unknown>): Promise<{ cycles: NormalizedCycle[]; pageInfo: ReturnType<typeof normalizePageInfo> }> {
  const first = validatePaginationFirst(input.first, { defaultValue: 25, maxValue: 100 });
  const after = optionalString(input.after, 'after');
  const teamId = optionalString(input.teamId, 'teamId');

  const filter: Record<string, unknown> = {};
  if (teamId) {
    filter.team = { id: { eq: teamId } };
  }

  const connection = await getLinearClient().cycles({
    first,
    after,
    ...(Object.keys(filter).length > 0 ? { filter } : {}),
    orderBy: 'createdAt',
  } as never);

  return {
    cycles: (connection.nodes ?? []).map(normalizeDiscoveryCycle),
    pageInfo: normalizePageInfo(connection.pageInfo),
  };
}

export const linearListCyclesTool = defineTool({
  name: 'linear_list_cycles',
  label: 'List Cycles',
  description: 'List Linear cycles so agents can discover cycle IDs for create and update.',
  promptSnippet: 'List cycles',
  promptGuidelines: ['Use linear_list_cycles before setting cycleId on create or update.'],
  parameters: listCyclesSchema,
  async execute(_toolCallId, input) {
    const result = await listLinearCycles(input as Record<string, unknown>);
    const heading = typeof input.teamId === 'string' && input.teamId.trim().length > 0
      ? `Found ${result.cycles.length} cycles for team ${input.teamId.trim()}:`
      : `Found ${result.cycles.length} cycles:`;
    const cycleLines = result.cycles.map(formatCycleLine);
    const text = cycleLines.length > 0 ? [heading, ...cycleLines].join('\n') : heading.slice(0, -1);

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
