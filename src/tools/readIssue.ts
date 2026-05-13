import { defineTool } from '@mariozechner/pi-coding-agent';
import { Type } from '@mariozechner/pi-ai';

import { getLinearClient } from '../client.js';
import { normalizeIssue } from '../linear/shared.js';
import { sharedIssueIdentifierSchema } from '../schemas.js';
import { isNonEmptyTrimmedString } from '../validation.js';
import { formatIssueSummary } from './format.js';

const readIssueSchema = Type.Object({
  issueId: sharedIssueIdentifierSchema,
});

export async function readIssue(input: Record<string, unknown>) {
  const issueReference = input.issueId;
  if (!isNonEmptyTrimmedString(issueReference)) {
    throw new Error('issueId must be a non-empty string.');
  }

  const issue = await getLinearClient().issue(issueReference.trim());
  if (!issue) {
    throw new Error(`Issue not found: ${issueReference}`);
  }

  return normalizeIssue(issue);
}

export const linearReadIssueTool = defineTool({
  name: 'linear_read_issue',
  label: 'Read Issue',
  description: 'Read a Linear issue by UUID or human identifier (e.g. ENG-123).',
  parameters: readIssueSchema,
  async execute(_toolCallId, input) {
    const issue = await readIssue(input as Record<string, unknown>);
    return {
      content: [{ type: 'text', text: `Read ${formatIssueSummary(issue)}` }],
      details: { issue },
    };
  },
});
