import { defineTool } from '@mariozechner/pi-coding-agent';
import { Type } from '@mariozechner/pi-ai';

import { getLinearClient } from '../client.js';
import { LinearValidationError } from '../errors.js';
import { resolveIssue } from '../linear/resolveIssue.js';
import { normalizeComment, type NormalizedComment, type NormalizedIssueSummary } from '../linear/shared.js';
import { sharedIssueIdentifierSchema } from '../schemas.js';
import { validateCommentBody } from '../validation.js';

const createCommentSchema = Type.Object({
  issueId: sharedIssueIdentifierSchema,
  body: Type.String(),
  parentId: Type.Optional(Type.String()),
});

export async function createComment(input: Record<string, unknown>): Promise<{ comment: NormalizedComment; issue: NormalizedIssueSummary }> {
  const issueReference = requireNonEmptyString(input.issueId, 'issueId');
  const body = validateCommentBody(input.body);
  const parentId = optionalString(input.parentId, 'parentId');

  const client = getLinearClient();
  const issue = await resolveIssue(client, issueReference);
  const payload = await client.createComment({
    issueId: issue.id,
    body,
    parentId,
  } as never);

  if (!payload.success) {
    throw new Error(`Failed to create Linear comment on ${issue.identifier}.`);
  }

  const commentModel = payload.comment ? await payload.comment : undefined;
  if (!commentModel) {
    throw new Error(`Linear createComment did not return a comment for ${issue.identifier}.`);
  }

  const comment = normalizeComment(commentModel);
  comment.issue = { ...issue, ...comment.issue };

  return { comment, issue };
}

export const linearCreateCommentTool = defineTool({
  name: 'linear_create_comment',
  label: 'Create Comment',
  description: 'Create a comment or threaded reply on a Linear issue.',
  promptSnippet: 'Comment on an issue',
  promptGuidelines: ['Use linear_create_comment for issue updates; read/list comments first if context matters.'],
  parameters: createCommentSchema,
  async execute(_toolCallId, input) {
    const result = await createComment(input as Record<string, unknown>);
    const urlSuffix = result.comment.url ? `: ${result.comment.url}` : '';
    return {
      content: [{ type: 'text', text: `Added comment ${result.comment.id} to ${result.issue.identifier} (issue id: ${result.issue.id})${urlSuffix}` }],
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
