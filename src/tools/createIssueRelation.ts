import { defineTool } from '@mariozechner/pi-coding-agent';
import { Type } from '@mariozechner/pi-ai';

import { getLinearClient } from '../client.js';
import { LinearValidationError } from '../errors.js';
import { resolveIssue } from '../linear/resolveIssue.js';

const publicRelationTypes = ['blocks', 'blocked_by', 'related'] as const;
export type PublicIssueRelationType = typeof publicRelationTypes[number];

export type NormalizedIssueRelation = {
  id: string;
  type: PublicIssueRelationType;
};

export type IssueRelationIssueSummary = {
  id: string;
  identifier: string;
  title: string;
};

export type CreateIssueRelationResult = {
  relation: NormalizedIssueRelation;
  issue: IssueRelationIssueSummary;
  relatedIssue: IssueRelationIssueSummary;
};

const createIssueRelationSchema = Type.Object({
  issueId: Type.String(),
  relatedIssueId: Type.String(),
  type: Type.Union(publicRelationTypes.map((type) => Type.Literal(type))),
});

export async function createIssueRelation(input: Record<string, unknown>): Promise<CreateIssueRelationResult> {
  const issueReference = requireNonEmptyString(input.issueId, 'issueId');
  const relatedIssueReference = requireNonEmptyString(input.relatedIssueId, 'relatedIssueId');
  const type = validateRelationType(input.type);
  const client = getLinearClient();

  const issue = await resolveIssue(client, issueReference);
  const relatedIssue = await resolveIssue(client, relatedIssueReference);
  const payload = buildIssueRelationPayload(issue.id, relatedIssue.id, type);
  const response = await client.createIssueRelation(payload as never);

  if (!response.success) {
    throw new Error(`Failed to create ${type} relation between ${issue.identifier} and ${relatedIssue.identifier}.`);
  }

  const relationModel = response.issueRelation ? await response.issueRelation : undefined;
  const relationId = getRelationId(relationModel, response.issueRelationId);
  if (!relationId) {
    throw new Error(`Linear createIssueRelation did not return a relation for ${issue.identifier} and ${relatedIssue.identifier}.`);
  }

  return {
    relation: { id: relationId, type },
    issue,
    relatedIssue,
  };
}

export const linearCreateIssueRelationTool = defineTool({
  name: 'linear_create_issue_relation',
  label: 'Create Issue Relation',
  description: 'Create a Linear relationship between two issues.',
  parameters: createIssueRelationSchema,
  async execute(_toolCallId, input) {
    const result = await createIssueRelation(input as Record<string, unknown>);
    return {
      content: [{ type: 'text', text: formatRelationResult(result) }],
      details: result,
    };
  },
});

export function buildIssueRelationPayload(
  issueId: string,
  relatedIssueId: string,
  type: PublicIssueRelationType,
): { issueId: string; relatedIssueId: string; type: 'blocks' | 'related' } {
  if (type === 'blocked_by') {
    return { issueId: relatedIssueId, relatedIssueId: issueId, type: 'blocks' };
  }

  return { issueId, relatedIssueId, type };
}

function formatRelationResult(result: CreateIssueRelationResult): string {
  if (result.relation.type === 'blocks') {
    return `Created relation: ${result.issue.identifier} blocks ${result.relatedIssue.identifier} (id: ${result.relation.id})`;
  }
  if (result.relation.type === 'blocked_by') {
    return `Created relation: ${result.issue.identifier} is blocked by ${result.relatedIssue.identifier} (id: ${result.relation.id})`;
  }
  return `Created relation: ${result.issue.identifier} is related to ${result.relatedIssue.identifier} (id: ${result.relation.id})`;
}

function requireNonEmptyString(value: unknown, fieldName: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new LinearValidationError(`${fieldName} must be a non-empty string.`);
  }
  return value.trim();
}

function validateRelationType(value: unknown): PublicIssueRelationType {
  if (typeof value !== 'string' || !publicRelationTypes.includes(value as PublicIssueRelationType)) {
    throw new LinearValidationError('type must be one of blocks, blocked_by, or related.');
  }
  return value as PublicIssueRelationType;
}

function getRelationId(relationModel: unknown, payloadRelationId: unknown): string | undefined {
  if (relationModel && typeof relationModel === 'object') {
    const id = (relationModel as { id?: unknown }).id;
    if (typeof id === 'string' && id.length > 0) {
      return id;
    }
  }
  return typeof payloadRelationId === 'string' && payloadRelationId.length > 0 ? payloadRelationId : undefined;
}
