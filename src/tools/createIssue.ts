import { defineTool } from '@mariozechner/pi-coding-agent';
import { Type } from '@mariozechner/pi-ai';

import { getLinearClient } from '../client.js';
import { LinearValidationError } from '../errors.js';
import { normalizeIssueSummary, type NormalizedIssueSummary } from '../linear/shared.js';
import { dueDateSchema, optionalTextSchema, prioritySchema } from '../schemas.js';
import { mapPriorityInputToLinear, validateDescription, validateDueDate, validateTitle } from '../validation.js';

const createIssueSchema = Type.Object({
  teamId: Type.String(),
  title: Type.String(),
  description: optionalTextSchema,
  assigneeId: Type.Optional(Type.String()),
  stateId: Type.Optional(Type.String()),
  priority: Type.Optional(prioritySchema),
  labelIds: Type.Optional(Type.Array(Type.String())),
  estimate: Type.Optional(Type.Number()),
  dueDate: Type.Optional(dueDateSchema),
});

export async function createIssue(input: Record<string, unknown>): Promise<NormalizedIssueSummary> {
  const teamId = requireNonEmptyString(input.teamId, 'teamId');
  const title = validateTitle(input.title);
  const description = validateDescription(input.description);
  const assigneeId = optionalString(input.assigneeId, 'assigneeId');
  const stateId = optionalString(input.stateId, 'stateId');
  const labelIds = optionalStringArray(input.labelIds, 'labelIds');
  const estimate = optionalNumber(input.estimate, 'estimate');
  const dueDate = validateDueDate(input.dueDate);
  const priority = mapPriorityInputToLinear(input.priority);

  const payload = await getLinearClient().createIssue({
    teamId,
    title,
    description,
    assigneeId,
    stateId,
    priority,
    labelIds,
    estimate,
    dueDate,
  });

  if (!payload.success) {
    throw new Error('Failed to create Linear issue.');
  }

  const issue = payload.issue ? await payload.issue : undefined;
  if (!issue) {
    throw new Error('Linear createIssue did not return an issue.');
  }

  return normalizeIssueSummary(issue);
}

export const linearCreateIssueTool = defineTool({
  name: 'linear_create_issue',
  label: 'Create Issue',
  description: 'Create a Linear issue with required team and title and optional metadata.',
  parameters: createIssueSchema,
  async execute(_toolCallId, input) {
    const issue = await createIssue(input as Record<string, unknown>);
    return {
      content: [{ type: 'text', text: `Created ${issue.identifier}` }],
      details: { issue },
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

function optionalStringArray(value: unknown, fieldName: string): string[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string' || item.trim().length === 0)) {
    throw new LinearValidationError(`${fieldName} must be an array of non-empty strings.`);
  }
  return value;
}

function optionalNumber(value: unknown, fieldName: string): number | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new LinearValidationError(`${fieldName} must be a finite number when provided.`);
  }
  return value;
}
