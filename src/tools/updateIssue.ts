import { defineTool } from '@mariozechner/pi-coding-agent';
import { Type } from '@mariozechner/pi-ai';

import { getLinearClient } from '../client.js';
import { LinearValidationError } from '../errors.js';
import { resolveIssue } from '../linear/resolveIssue.js';
import { normalizeIssueSummary } from '../linear/shared.js';
import { dueDateSchema, optionalTextSchema, prioritySchema, sharedIssueIdentifierSchema } from '../schemas.js';
import {
  isWhitespaceOnlyString,
  mapPriorityInputToLinear,
  validateDescription,
  validateDueDate,
  validateTitle,
} from '../validation.js';
import { formatIssueSummary } from './format.js';

const updateIssueSchema = Type.Object({
  issueId: sharedIssueIdentifierSchema,
  title: Type.Optional(Type.String()),
  description: optionalTextSchema,
  stateId: Type.Optional(Type.String()),
  assigneeId: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  priority: Type.Optional(prioritySchema),
  labelIds: Type.Optional(Type.Array(Type.String())),
  estimate: Type.Optional(Type.Union([Type.Number(), Type.Null()])),
  dueDate: Type.Optional(Type.Union([dueDateSchema, Type.Null()])),
  parentId: Type.Optional(Type.Union([Type.String(), Type.Null()])),
});

const mutableFields = ['title', 'description', 'stateId', 'assigneeId', 'priority', 'labelIds', 'estimate', 'dueDate', 'parentId'] as const;

export async function updateIssue(input: Record<string, unknown>) {
  const issueReference = requireNonEmptyString(input.issueId, 'issueId');

  const client = getLinearClient();
  const resolved = await resolveIssue(client, issueReference);
  const parentId = await resolveOptionalParentId(client, input.parentId);
  const updateInput = buildIssueUpdateInput(input, { parentId });
  const payload = await client.updateIssue(resolved.id, updateInput as never);

  if (!payload.success) {
    throw new Error(`Failed to update Linear issue ${resolved.identifier}.`);
  }

  const issue = payload.issue ? await payload.issue : undefined;
  if (!issue) {
    throw new Error(`Linear updateIssue did not return issue ${resolved.identifier}.`);
  }

  return normalizeIssueSummary(issue);
}

export function buildIssueUpdateInput(
  input: Record<string, unknown>,
  options?: { parentId?: string | null },
): Record<string, unknown> {
  if (!mutableFields.some((field) => input[field] !== undefined)) {
    throw new LinearValidationError('Provide at least one mutable field to update.');
  }

  const title = input.title === undefined ? undefined : validateTitle(input.title);
  const description = input.description === undefined
    ? undefined
    : validateDescription(input.description, { allowEmpty: true });

  if (isWhitespaceOnlyString(description)) {
    throw new LinearValidationError('description must not be blank.');
  }

  const stateId = optionalNullableString(input.stateId, 'stateId', { allowNull: false });
  const assigneeId = optionalNullableString(input.assigneeId, 'assigneeId', { allowNull: true });
  const labelIds = optionalStringArray(input.labelIds, 'labelIds');
  const estimate = optionalNullableNumber(input.estimate, 'estimate');
  const dueDate = input.dueDate === null ? null : validateDueDate(input.dueDate);
  const priority = mapPriorityInputToLinear(input.priority);

  const updateInput: Record<string, unknown> = {
    title,
    description,
    stateId,
    assigneeId,
    labelIds,
    estimate,
    dueDate,
    priority,
  };

  if (options?.parentId !== undefined) {
    updateInput.parentId = options.parentId;
  }

  return updateInput;
}

export const linearUpdateIssueTool = defineTool({
  name: 'linear_update_issue',
  label: 'Update Issue',
  description: 'Update mutable fields on a Linear issue by UUID or human identifier, including optional parent reparenting.',
  promptSnippet: 'Update issue fields',
  promptGuidelines: ['Use linear_update_issue after confirming the target issue and desired field changes.'],
  parameters: updateIssueSchema,
  async execute(_toolCallId, input) {
    const issue = await updateIssue(input as Record<string, unknown>);
    return {
      content: [{ type: 'text', text: `Updated ${formatIssueSummary(issue)}` }],
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

function optionalNullableString(
  value: unknown,
  fieldName: string,
  options: { allowNull: boolean },
): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) {
    if (!options.allowNull) {
      throw new LinearValidationError(`${fieldName} cannot be null.`);
    }
    return null;
  }
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

function optionalNullableNumber(value: unknown, fieldName: string): number | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new LinearValidationError(`${fieldName} must be a finite number or null when provided.`);
  }
  return value;
}

async function resolveOptionalParentId(
  client: ReturnType<typeof getLinearClient>,
  value: unknown,
): Promise<string | null | undefined> {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return null;
  }

  const parentReference = requireNonEmptyString(value, 'parentId');
  const resolvedParent = await resolveIssue(client, parentReference);
  return resolvedParent.id;
}
