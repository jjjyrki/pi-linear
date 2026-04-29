import { jest } from '@jest/globals';

import { createLinearClient, getLinearClient, resetLinearClientCache } from '../src/client.js';
import { LinearConfigurationError, LinearNotFoundError, LinearValidationError } from '../src/errors.js';
import { normalizeComment } from '../src/linear/normalizeComment.js';
import {
  normalizeDiscoveryTeam,
  normalizeDiscoveryUser,
  normalizeDiscoveryWorkflowState,
  normalizePageInfo,
  normalizeViewer,
} from '../src/linear/normalizeDiscovery.js';
import { normalizeIssue, normalizeIssueSummary } from '../src/linear/normalizeIssue.js';
import { resolveIssue } from '../src/linear/resolveIssue.js';
import type { LinearIssueResolverClient } from '../src/linear/shared.js';
import {
  isLinearUuid,
  isNonEmptyTrimmedString,
  isWhitespaceOnlyString,
  mapPriorityInputToLinear,
  mapPriorityOutput,
  validateCommentBody,
  validateDescription,
  validateDueDate,
  validatePaginationFirst,
  validateTitle,
} from '../src/validation.js';

describe('linear core helpers', () => {
  afterEach(() => {
    resetLinearClientCache();
    delete process.env.LINEAR_API_KEY;
  });

  it('creates a Linear client from LINEAR_API_KEY and caches it lazily', () => {
    process.env.LINEAR_API_KEY = 'lin_api_test';

    const client = createLinearClient();
    const cachedA = getLinearClient();
    const cachedB = getLinearClient();

    expect(client).toBeDefined();
    expect(cachedA).toBe(cachedB);
  });

  it('fails cleanly when LINEAR_API_KEY is missing', () => {
    expect(() => createLinearClient({})).toThrow(LinearConfigurationError);
    expect(() => createLinearClient({})).toThrow(/LINEAR_API_KEY/);
  });

  it('validates shared strings, dates, pagination, and priorities', () => {
    expect(isNonEmptyTrimmedString(' hello ')).toBe(true);
    expect(isWhitespaceOnlyString('   ')).toBe(true);
    expect(isLinearUuid('550e8400-e29b-41d4-a716-446655440000')).toBe(true);

    expect(validateTitle('Hello')).toBe('Hello');
    expect(validateDescription('markdown')).toBe('markdown');
    expect(validateDescription('', { allowEmpty: true })).toBe('');
    expect(validateCommentBody('comment')).toBe('comment');
    expect(validateDueDate('2026-04-29')).toBe('2026-04-29');
    expect(validatePaginationFirst(undefined)).toBe(25);
    expect(validatePaginationFirst(100)).toBe(100);
    expect(mapPriorityInputToLinear('high')).toBe(2);
    expect(mapPriorityOutput(2, 'High')).toEqual({ value: 'high', label: 'High' });

    expect(() => validateTitle('   ')).toThrow(LinearValidationError);
    expect(() => validateDescription('   ')).toThrow(LinearValidationError);
    expect(() => validateCommentBody('')).toThrow(LinearValidationError);
    expect(() => validateDueDate('2026-02-30')).toThrow(LinearValidationError);
    expect(() => validatePaginationFirst(101)).toThrow(/at most 100/);
    expect(() => mapPriorityInputToLinear('invalid')).toThrow(LinearValidationError);
  });

  it('normalizes issues, comments, and discovery payloads', () => {
    const issue = normalizeIssue({
      id: 'issue-1',
      identifier: 'ENG-1',
      title: 'Fix it',
      description: 'body',
      url: 'https://linear.app/issue/ENG-1',
      state: { id: 'state-1', name: 'In Progress', type: 'started' },
      assignee: { id: 'user-1', name: 'Ada Lovelace', email: 'ada@example.com' },
      team: { id: 'team-1', key: 'ENG', name: 'Engineering' },
      priority: 2,
      priorityLabel: 'High',
      labels: [{ id: 'label-1', name: 'bug', color: '#ff0000' }],
      estimate: 3,
      dueDate: '2026-05-01',
      createdAt: new Date('2026-04-01T00:00:00.000Z'),
      updatedAt: '2026-04-02T00:00:00.000Z',
    });

    expect(issue).toMatchObject({
      id: 'issue-1',
      identifier: 'ENG-1',
      title: 'Fix it',
      description: 'body',
      assignee: { id: 'user-1', name: 'Ada Lovelace' },
      team: { id: 'team-1', key: 'ENG', name: 'Engineering' },
      priority: { value: 'high', label: 'High' },
      labels: [{ id: 'label-1', name: 'bug', color: '#ff0000' }],
    });
    expect(issue.assignee).not.toHaveProperty('email');

    expect(normalizeIssueSummary(issue)).toMatchObject({
      id: 'issue-1',
      identifier: 'ENG-1',
      title: 'Fix it',
    });

    const comment = normalizeComment({
      id: 'comment-1',
      body: 'Looks good',
      parentId: 'comment-root',
      issue: { id: 'issue-1', identifier: 'ENG-1', title: 'Fix it' },
      user: { id: 'user-2', displayName: 'Grace', email: 'grace@example.com' },
      createdAt: new Date('2026-04-02T01:00:00.000Z'),
      updatedAt: '2026-04-02T02:00:00.000Z',
      editedAt: '2026-04-02T03:00:00.000Z',
    });

    expect(comment).toMatchObject({
      id: 'comment-1',
      body: 'Looks good',
      parentId: 'comment-root',
      issue: { id: 'issue-1', identifier: 'ENG-1', title: 'Fix it' },
      user: { id: 'user-2', displayName: 'Grace' },
      editedAt: '2026-04-02T03:00:00.000Z',
    });
    expect(comment.user).not.toHaveProperty('email');

    expect(normalizeViewer({ id: 'user-3', displayName: 'Viewer', email: 'viewer@example.com' })).toEqual({
      id: 'user-3',
      displayName: 'Viewer',
      email: 'viewer@example.com',
    });
    expect(normalizeDiscoveryUser({ id: 'user-4', name: 'User Four', email: 'user4@example.com' })).toEqual({
      id: 'user-4',
      name: 'User Four',
      email: 'user4@example.com',
    });
    expect(normalizeDiscoveryTeam({ id: 'team-2', key: 'OPS', name: 'Ops' })).toEqual({
      id: 'team-2',
      key: 'OPS',
      name: 'Ops',
    });
    expect(normalizeDiscoveryWorkflowState({ id: 'state-2', name: 'Done', type: 'completed', team: { id: 'team-2' } })).toEqual({
      id: 'state-2',
      name: 'Done',
      type: 'completed',
      team: { id: 'team-2' },
    });
    expect(normalizePageInfo({ hasNextPage: true, hasPreviousPage: false, endCursor: 'abc', startCursor: 'def' })).toEqual({
      hasNextPage: true,
      hasPreviousPage: false,
      endCursor: 'abc',
      startCursor: 'def',
    });
  });

  it('resolves issues and surfaces not-found errors', async () => {
    const issue = jest.fn() as jest.MockedFunction<(
      id: string,
    ) => Promise<{ id: string; identifier: string; title: string }>>;
    issue.mockResolvedValue({ id: 'issue-1', identifier: 'ENG-1', title: 'Fix it' });
    const client = { issue } as unknown as LinearIssueResolverClient;

    await expect(resolveIssue(client, 'ENG-1')).resolves.toEqual({
      id: 'issue-1',
      identifier: 'ENG-1',
      title: 'Fix it',
    });
    expect(issue).toHaveBeenCalledWith('ENG-1');

    const missingIssue = jest.fn() as jest.MockedFunction<(id: string) => Promise<undefined>>;
    missingIssue.mockResolvedValue(undefined);
    const missingClient = { issue: missingIssue } as unknown as LinearIssueResolverClient;

    await expect(resolveIssue(missingClient, 'ENG-404')).rejects.toThrow(LinearNotFoundError);
  });
});
