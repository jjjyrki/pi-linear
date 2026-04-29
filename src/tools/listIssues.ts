import { defineTool } from '@mariozechner/pi-coding-agent';
import { Type } from '@mariozechner/pi-ai';

import { getLinearClient } from '../client.js';
import { LinearValidationError } from '../errors.js';
import { normalizeIssueSummary, normalizePageInfo } from '../linear/shared.js';
import { validatePaginationFirst } from '../validation.js';

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

  const issues = (connection.nodes ?? []).map((issue) => normalizeIssueSummary(issue));
  const pageInfo = normalizePageInfo(connection.pageInfo);

  return { issues, pageInfo };
}

export const linearListIssuesTool = defineTool({
  name: 'linear_list_issues',
  label: 'List Issues',
  description: 'List open, non-archived Linear issues (updated most recently first).',
  parameters: listIssuesSchema,
  async execute(_toolCallId, input) {
    const result = await listIssues(input as Record<string, unknown>);
    return {
      content: [{ type: 'text', text: `Found ${result.issues.length} issues` }],
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
