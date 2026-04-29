import { defineTool } from '@mariozechner/pi-coding-agent';
import { Type } from '@mariozechner/pi-ai';

import { getLinearClient } from '../client.js';
import { LinearValidationError } from '../errors.js';
import { resolveIssue } from '../linear/resolveIssue.js';
import { normalizeComment, normalizePageInfo, type NormalizedComment, type NormalizedIssueSummary } from '../linear/shared.js';
import { sharedIssueIdentifierSchema } from '../schemas.js';
import { validatePaginationFirst } from '../validation.js';

const listCommentsSchema = Type.Object({
  issueId: sharedIssueIdentifierSchema,
  first: Type.Optional(Type.Number()),
  after: Type.Optional(Type.String()),
});

export async function listComments(input: Record<string, unknown>): Promise<{ nodes: NormalizedComment[]; pageInfo: ReturnType<typeof normalizePageInfo>; issue: NormalizedIssueSummary }> {
  const issueReference = requireNonEmptyString(input.issueId, 'issueId');
  const first = validatePaginationFirst(input.first, { defaultValue: 25, maxValue: 100 });
  const after = optionalString(input.after, 'after');

  const client = getLinearClient();
  const issue = await resolveIssue(client, issueReference);
  const commentsConnection = await client.comments({
    first,
    after,
    filter: { issue: { id: { eq: issue.id } } },
    orderBy: 'createdAt',
  } as never);

  const nodes = (commentsConnection.nodes ?? []).map((comment) => {
    const normalized = normalizeComment(comment);
    normalized.issue = { ...issue, ...normalized.issue };
    return normalized;
  });

  return {
    nodes,
    pageInfo: normalizePageInfo(commentsConnection.pageInfo),
    issue,
  };
}

export const linearListCommentsTool = defineTool({
  name: 'linear_list_comments',
  label: 'List Comments',
  description: 'List comments for a Linear issue in chronological order.',
  parameters: listCommentsSchema,
  async execute(_toolCallId, input) {
    const result = await listComments(input as Record<string, unknown>);
    return {
      content: [{ type: 'text', text: `Found ${result.nodes.length} comments on ${result.issue.identifier}` }],
      details: result,
    };
  },
});

function requireNonEmptyString(value: unknown, fieldName: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new LinearValidationError(`${fieldName} must be a non-empty string.`);
  }
  return value;
}

function optionalString(value: unknown, fieldName: string): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new LinearValidationError(`${fieldName} must be a non-empty string when provided.`);
  }
  return value;
}
