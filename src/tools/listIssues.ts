import { defineTool } from '@mariozechner/pi-coding-agent';
import { Type } from '@mariozechner/pi-ai';

import { getLinearClient } from '../client.js';
import { LinearValidationError } from '../errors.js';
import { normalizeIssueSummary, normalizePageInfo } from '../linear/shared.js';
import { validatePaginationFirst } from '../validation.js';
import { formatIssueLine } from './format.js';

const listIssuesSchema = Type.Object({
  first: Type.Optional(Type.Number()),
  after: Type.Optional(Type.String()),
  teamId: Type.Optional(Type.String()),
  assigneeId: Type.Optional(Type.String()),
  stateId: Type.Optional(Type.String()),
});

export async function listIssues(input: Record<string, unknown>) {
  const first = validatePaginationFirst(input.first, { defaultValue: 25, maxValue: 100 });
  const after = optionalString(input.after, 'after');
  const teamId = optionalString(input.teamId, 'teamId');
  const assigneeId = optionalString(input.assigneeId, 'assigneeId');
  const stateId = optionalString(input.stateId, 'stateId');

  const filter: Record<string, unknown> = {
    archivedAt: { null: true },
  };

  if (teamId) {
    filter.team = { id: { eq: teamId } };
  }
  if (assigneeId) {
    filter.assignee = { id: { eq: assigneeId } };
  }
  if (stateId) {
    filter.state = { id: { eq: stateId } };
  } else {
    filter.state = { type: { nin: ['completed', 'canceled'] } };
  }

  const connection = await getLinearClient().issues({
    first,
    after,
    filter,
    orderBy: 'updatedAt',
  } as never);

  const nodes = (connection.nodes ?? []).map((issue) => normalizeIssueSummary(issue));
  const pageInfo = normalizePageInfo(connection.pageInfo);

  return { nodes, pageInfo };
}

export const linearListIssuesTool = defineTool({
  name: 'linear_list_issues',
  label: 'List Issues',
  description: 'List open, non-archived Linear issues (updated most recently first).',
  promptSnippet: 'List recent open issues',
  promptGuidelines: ['Use linear_list_issues to browse open work; search/read for targeted lookup.'],
  parameters: listIssuesSchema,
  async execute(_toolCallId, input) {
    const result = await listIssues(input as Record<string, unknown>);
    const issueLines = result.nodes.map(formatIssueLine);
    const text = issueLines.length > 0
      ? [`Found ${result.nodes.length} issues:`, ...issueLines].join('\n')
      : 'Found 0 issues';
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
