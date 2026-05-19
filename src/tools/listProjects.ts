import { defineTool } from '@mariozechner/pi-coding-agent';
import { Type } from '@mariozechner/pi-ai';

import { getLinearClient } from '../client.js';
import { LinearValidationError } from '../errors.js';
import { normalizeDiscoveryProject, normalizePageInfo, type NormalizedProject } from '../linear/shared.js';
import { validatePaginationFirst } from '../validation.js';
import { formatProjectLine } from './format.js';

const listProjectsSchema = Type.Object({
  teamId: Type.Optional(Type.String()),
  query: Type.Optional(Type.String()),
  statusId: Type.Optional(Type.String()),
  first: Type.Optional(Type.Number()),
  after: Type.Optional(Type.String()),
});

export async function listLinearProjects(input: Record<string, unknown>): Promise<{ projects: NormalizedProject[]; pageInfo: ReturnType<typeof normalizePageInfo> }> {
  const first = validatePaginationFirst(input.first, { defaultValue: 25, maxValue: 100 });
  const after = optionalString(input.after, 'after');
  const teamId = optionalString(input.teamId, 'teamId');
  const statusId = optionalString(input.statusId, 'statusId');
  const query = optionalQuery(input.query);

  const filter: Record<string, unknown> = {
    trashed: { eq: false },
  };
  if (teamId) {
    filter.accessibleTeams = { some: { id: { eq: teamId } } };
  }
  if (statusId) {
    filter.status = { id: { eq: statusId } };
  }
  if (query) {
    filter.name = { containsIgnoreCase: query };
  }

  const connection = await getLinearClient().projects({
    first,
    after,
    filter,
  } as never);

  return {
    projects: (connection.nodes ?? []).map(normalizeDiscoveryProject),
    pageInfo: normalizePageInfo(connection.pageInfo),
  };
}

export const linearListProjectsTool = defineTool({
  name: 'linear_list_projects',
  label: 'List Projects',
  description: 'List Linear projects so agents can discover project IDs for create and update.',
  promptSnippet: 'List projects',
  promptGuidelines: ['Use linear_list_projects before setting projectId on create or update.'],
  parameters: listProjectsSchema,
  async execute(_toolCallId, input) {
    const result = await listLinearProjects(input as Record<string, unknown>);
    const heading = typeof input.query === 'string' && input.query.trim().length > 0
      ? `Found ${result.projects.length} projects matching "${input.query.trim()}":`
      : `Found ${result.projects.length} projects:`;
    const projectLines = result.projects.map(formatProjectLine);
    const text = projectLines.length > 0 ? [heading, ...projectLines].join('\n') : heading.slice(0, -1);

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
