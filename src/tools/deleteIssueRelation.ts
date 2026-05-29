import { defineTool } from '@mariozechner/pi-coding-agent';
import { Type } from '@mariozechner/pi-ai';

import { getLinearClient } from '../client.js';
import { LinearValidationError } from '../errors.js';

const deleteIssueRelationSchema = Type.Object({
  relationId: Type.String(),
});

export async function deleteIssueRelation(input: Record<string, unknown>): Promise<{ relationId: string }> {
  const relationId = requireNonEmptyString(input.relationId, 'relationId');
  const response = await getLinearClient().deleteIssueRelation(relationId);

  if (!response.success) {
    throw new Error(`Failed to delete issue relation ${relationId}.`);
  }

  return {
    relationId: response.entityId || relationId,
  };
}

export const linearDeleteIssueRelationTool = defineTool({
  name: 'linear_delete_issue_relation',
  label: 'Delete Issue Relation',
  description: 'Delete an existing Linear issue relationship by relation ID.',
  promptSnippet: 'Delete issue relationship',
  promptGuidelines: ['Use linear_delete_issue_relation only after confirming the relation ID to remove.'],
  parameters: deleteIssueRelationSchema,
  async execute(_toolCallId, input) {
    const result = await deleteIssueRelation(input as Record<string, unknown>);
    return {
      content: [{ type: 'text', text: `Deleted issue relation ${result.relationId}` }],
      details: result,
    };
  },
});

function requireNonEmptyString(value: unknown, fieldName: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new LinearValidationError(`${fieldName} must be a non-empty string.`);
  }
  return value.trim();
}
