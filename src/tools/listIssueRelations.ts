import { defineTool } from '@mariozechner/pi-coding-agent';
import { Type } from '@mariozechner/pi-ai';

import { getLinearClient } from '../client.js';
import { LinearValidationError } from '../errors.js';
import { resolveIssue } from '../linear/resolveIssue.js';
import { normalizeIsoDateTime, type NormalizedIssueSummary } from '../linear/shared.js';
import { sharedIssueIdentifierSchema } from '../schemas.js';
import { formatIssueRelationLine } from './format.js';
import type { PublicIssueRelationType } from './createIssueRelation.js';

export type ListedIssueRelation = {
  id: string;
  type: PublicIssueRelationType;
  counterpartIssue: {
    id: string;
    identifier: string;
    title: string;
  };
  createdAt?: string;
  updatedAt?: string;
};

const listIssueRelationsSchema = Type.Object({
  issueId: sharedIssueIdentifierSchema,
});

export async function listIssueRelations(input: Record<string, unknown>): Promise<{ issue: NormalizedIssueSummary; nodes: ListedIssueRelation[] }> {
  const issueReference = requireNonEmptyString(input.issueId, 'issueId');
  const client = getLinearClient();
  const issue = await resolveIssue(client, issueReference);
  const issueModel = await client.issue(issue.id);
  if (!issueModel) {
    throw new Error(`Issue not found: ${issueReference}`);
  }

  const [outgoingConnection, incomingConnection] = await Promise.all([
    issueModel.relations(),
    issueModel.inverseRelations(),
  ]);

  const nodes = await normalizeListedRelations([
    ...(outgoingConnection.nodes ?? []).map((relation) => ({ relation, direction: 'outgoing' as const })),
    ...(incomingConnection.nodes ?? []).map((relation) => ({ relation, direction: 'incoming' as const })),
  ]);

  return { issue, nodes };
}

export const linearListIssueRelationsTool = defineTool({
  name: 'linear_list_issue_relations',
  label: 'List Issue Relations',
  description: 'List relationships for a Linear issue.',
  promptSnippet: 'List issue relationships',
  promptGuidelines: ['Use linear_list_issue_relations before removing a dependency relation.'],
  parameters: listIssueRelationsSchema,
  async execute(_toolCallId, input) {
    const result = await listIssueRelations(input as Record<string, unknown>);
    const relationLines = result.nodes.map(formatIssueRelationLine);
    const text = relationLines.length > 0
      ? [`Found ${result.nodes.length} relations for ${result.issue.identifier} (issue id: ${result.issue.id}):`, ...relationLines].join('\n')
      : `Found 0 relations for ${result.issue.identifier} (issue id: ${result.issue.id})`;
    return {
      content: [{ type: 'text', text }],
      details: result,
    };
  },
});

async function normalizeListedRelations(
  relations: Array<{ relation: unknown; direction: 'outgoing' | 'incoming' }>,
): Promise<ListedIssueRelation[]> {
  const nodes = await Promise.all(relations.map(async ({ relation, direction }) => normalizeListedRelation(relation, direction)));
  return nodes.sort((left, right) => {
    const leftUpdatedAt = left.updatedAt ?? left.createdAt ?? '';
    const rightUpdatedAt = right.updatedAt ?? right.createdAt ?? '';
    return rightUpdatedAt.localeCompare(leftUpdatedAt) || left.counterpartIssue.identifier.localeCompare(right.counterpartIssue.identifier);
  });
}

async function normalizeListedRelation(
  relation: unknown,
  direction: 'outgoing' | 'incoming',
): Promise<ListedIssueRelation> {
  const candidate = asRecord(relation, 'issue relation data is missing or invalid.');
  const id = getString(candidate.id);
  const rawType = getString(candidate.type);
  const sourceIssueId = getString(candidate.issueId) ?? getNestedId(candidate.issue);
  const targetIssueId = getString(candidate.relatedIssueId) ?? getNestedId(candidate.relatedIssue);

  if (!id || !rawType || !sourceIssueId || !targetIssueId) {
    throw new LinearValidationError('issue relation data is missing required fields.');
  }

  const counterpartIssueId = direction === 'outgoing' ? targetIssueId : sourceIssueId;
  const counterpartIssue = await resolveIssue(getLinearClient(), counterpartIssueId);

  return {
    id,
    type: normalizePublicRelationType(rawType, direction),
    counterpartIssue,
    createdAt: normalizeIsoDateTime(candidate.createdAt),
    updatedAt: normalizeIsoDateTime(candidate.updatedAt),
  };
}

function normalizePublicRelationType(rawType: string, direction: 'outgoing' | 'incoming'): PublicIssueRelationType {
  if (rawType === 'related') {
    return 'related';
  }
  if (rawType === 'blocks') {
    return direction === 'outgoing' ? 'blocks' : 'blocked_by';
  }
  throw new LinearValidationError(`Unsupported issue relation type returned by Linear: ${rawType}`);
}

function requireNonEmptyString(value: unknown, fieldName: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new LinearValidationError(`${fieldName} must be a non-empty string.`);
  }
  return value.trim();
}

function asRecord(value: unknown, message: string): Record<string, unknown> {
  if (!value || typeof value !== 'object') {
    throw new LinearValidationError(message);
  }
  return value as Record<string, unknown>;
}

function getString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function getNestedId(value: unknown): string | undefined {
  if (!value || typeof value !== 'object') {
    return undefined;
  }
  return getString((value as { id?: unknown }).id);
}
