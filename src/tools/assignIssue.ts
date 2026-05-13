import { defineTool } from '@mariozechner/pi-coding-agent';
import { Type } from '@mariozechner/pi-ai';

import { sharedIssueIdentifierSchema } from '../schemas.js';
import { updateIssue } from './updateIssue.js';

const assignIssueSchema = Type.Object({
  issueId: sharedIssueIdentifierSchema,
  assigneeId: Type.Optional(Type.Union([Type.String(), Type.Null()])),
});

export async function assignIssue(input: Record<string, unknown>) {
  return updateIssue({
    issueId: input.issueId,
    assigneeId: input.assigneeId ?? null,
  });
}

export const linearAssignIssueTool = defineTool({
  name: 'linear_assign_issue',
  label: 'Assign Issue',
  description: 'Assign or unassign a Linear issue by UUID or human identifier.',
  parameters: assignIssueSchema,
  async execute(_toolCallId, input) {
    const issue = await assignIssue(input as Record<string, unknown>);
    return {
      content: [{ type: 'text', text: `${input.assigneeId == null ? 'Unassigned' : 'Assigned'} ${issue.identifier}` }],
      details: { issue },
    };
  },
});
