import { defineTool } from '@mariozechner/pi-coding-agent';
import { Type } from '@mariozechner/pi-ai';

import { getLinearClient } from '../client.js';
import { LinearValidationError } from '../errors.js';
import { normalizeIssueSummary, normalizePageInfo, type NormalizedIssueSummary, type NormalizedPageInfo } from '../linear/shared.js';
import { validatePaginationFirst } from '../validation.js';
import { formatIssueLine } from './format.js';

const searchIssuesSchema = Type.Object({
  query: Type.String(),
  teamId: Type.Optional(Type.String()),
  includeArchived: Type.Optional(Type.Boolean()),
  first: Type.Optional(Type.Number()),
});

export type SearchIssuesResult = {
  issues: NormalizedIssueSummary[];
  pageInfo?: NormalizedPageInfo;
  totalCount?: number;
};

export async function searchIssues(input: Record<string, unknown>): Promise<SearchIssuesResult> {
  const query = requireTrimmedString(input.query, 'query');
  const first = validatePaginationFirst(input.first, { defaultValue: 25, maxValue: 100 });
  const teamId = optionalString(input.teamId, 'teamId');
  const includeArchived = optionalBoolean(input.includeArchived, 'includeArchived') ?? false;

  const result = await getLinearClient().searchIssues(query, {
    first,
    includeArchived,
    ...(teamId ? { teamId } : {}),
  } as never);

  const searchResult: SearchIssuesResult = {
    issues: (result.nodes ?? []).map((issue) => normalizeIssueSummary(issue)),
  };

  if (result.pageInfo) {
    searchResult.pageInfo = normalizePageInfo(result.pageInfo);
  }
  if (typeof result.totalCount === 'number') {
    searchResult.totalCount = result.totalCount;
  }

  return searchResult;
}

export const linearSearchIssuesTool = defineTool({
  name: 'linear_search_issues',
  label: 'Search Issues',
  description: 'Search Linear issues by title, task ID, or other text.',
  parameters: searchIssuesSchema,
  async execute(_toolCallId, input) {
    const result = await searchIssues(input as Record<string, unknown>);
    const query = requireTrimmedString((input as Record<string, unknown>).query, 'query');
    const issueLines = result.issues.map(formatIssueLine);
    const text = issueLines.length > 0
      ? [`Found ${result.issues.length} issues matching "${query}":`, ...issueLines].join('\n')
      : `Found 0 issues matching "${query}"`;

    return {
      content: [{ type: 'text', text }],
      details: result,
    };
  },
});

function requireTrimmedString(value: unknown, fieldName: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new LinearValidationError(`${fieldName} must be a non-empty string.`);
  }
  return value.trim();
}

function optionalString(value: unknown, fieldName: string): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new LinearValidationError(`${fieldName} must be a non-empty string when provided.`);
  }
  return value;
}

function optionalBoolean(value: unknown, fieldName: string): boolean | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'boolean') {
    throw new LinearValidationError(`${fieldName} must be a boolean when provided.`);
  }
  return value;
}
