import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { jest } from '@jest/globals';

const getLinearClientMock = jest.fn();

jest.unstable_mockModule('../src/client.js', () => ({
  getLinearClient: getLinearClientMock,
}));

const { parseTaskMarkdownContent } = await import('../src/taskFiles.js');
const { syncTaskFile, linearSyncTaskFileTool } = await import('../src/tools/syncTaskFile.js');

const taskMarkdown = `id: TASK-1234
status: todo
summary: Build the thing

# Goal
Ship it.

# Implementation sub-tasks
- [ ] TASK-1234.1: Create storage
  - Dependencies: TASK-1234.0
  Persist records.
- [ ] 2: Wire API
  - Blocked by: TASK-1234.1
  Expose endpoints.
`;

describe('task file sync', () => {
  let tempDir: string;
  let taskFilePath: string;

  beforeEach(async () => {
    getLinearClientMock.mockReset();
    tempDir = await mkdtemp(path.join(os.tmpdir(), 'pi-linear-task-sync-'));
    taskFilePath = path.join(tempDir, 'TASK-1234.md');
    await writeFile(taskFilePath, taskMarkdown, 'utf8');
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('parses task headers, sub-tasks, and dependency metadata', () => {
    const parsed = parseTaskMarkdownContent(taskMarkdown, 'TASK-1234.md');

    expect(parsed).toMatchObject({ id: 'TASK-1234', status: 'todo', summary: 'Build the thing' });
    expect(parsed.subTasks).toEqual([
      { key: 'TASK-1234.1', title: 'Create storage', description: 'Persist records.', blockedBy: ['TASK-1234.0'] },
      { key: 'TASK-1234.2', title: 'Wire API', description: 'Expose endpoints.', blockedBy: ['TASK-1234.1'] },
    ]);
  });

  it('dry-runs planned parent, sub-issues, and dependency relations without mutations', async () => {
    const searchIssuesFn = jest.fn().mockResolvedValue({ nodes: [] } as never);
    const createIssueFn = jest.fn();
    const updateIssueFn = jest.fn();
    const createIssueRelationFn = jest.fn();
    getLinearClientMock.mockReturnValue({ searchIssues: searchIssuesFn, createIssue: createIssueFn, updateIssue: updateIssueFn, createIssueRelation: createIssueRelationFn } as never);

    const result = await syncTaskFile({
      teamId: 't1',
      taskFilePath,
      mode: 'dry_run',
      createSubtasks: true,
      linkDependencies: true,
    });

    expect(result.parent.action).toBe('would_create');
    expect(result.subissues.map((subissue) => [subissue.key, subissue.action])).toEqual([
      ['TASK-1234.1', 'would_create'],
      ['TASK-1234.2', 'would_create'],
    ]);
    expect(result.relations).toEqual([
      { action: 'would_create', issueKey: 'TASK-1234.1', blockedBy: ['TASK-1234.0'] },
      { action: 'would_create', issueKey: 'TASK-1234.2', blockedBy: ['TASK-1234.1'] },
    ]);
    expect(createIssueFn).not.toHaveBeenCalled();
    expect(updateIssueFn).not.toHaveBeenCalled();
    expect(createIssueRelationFn).not.toHaveBeenCalled();
  });

  it('creates only missing parent and sub-issues and preserves existing sub-issues', async () => {
    const searchIssuesFn = jest.fn()
      .mockResolvedValueOnce({ nodes: [] } as never)
      .mockResolvedValueOnce({ nodes: [] } as never)
      .mockResolvedValueOnce({ nodes: [{ id: 's2', identifier: 'ENG-3', title: 'TASK-1234.2: Wire API' }] } as never);
    const issueFn = jest.fn().mockResolvedValue({ id: 'p1', identifier: 'ENG-1', title: 'TASK-1234: Build the thing' } as never);
    const createIssueFn = jest.fn()
      .mockResolvedValueOnce({
        success: true,
        issue: Promise.resolve({ id: 'p1', identifier: 'ENG-1', title: 'TASK-1234: Build the thing' }),
      } as never)
      .mockResolvedValueOnce({
        success: true,
        issue: Promise.resolve({ id: 's1', identifier: 'ENG-2', title: 'TASK-1234.1: Create storage', parent: { id: 'p1', identifier: 'ENG-1' } }),
      } as never);

    getLinearClientMock.mockReturnValue({ searchIssues: searchIssuesFn, issue: issueFn, createIssue: createIssueFn } as never);

    const result = await syncTaskFile({ teamId: 't1', taskFilePath, mode: 'create_missing', createSubtasks: true });

    expect(result.parent).toMatchObject({ action: 'created', issue: { id: 'p1', identifier: 'ENG-1' } });
    expect(result.subissues.map((subissue) => [subissue.key, subissue.action, subissue.issue?.identifier])).toEqual([
      ['TASK-1234.1', 'created', 'ENG-2'],
      ['TASK-1234.2', 'unchanged', 'ENG-3'],
    ]);
    expect(createIssueFn).toHaveBeenNthCalledWith(1, expect.objectContaining({ title: 'TASK-1234: Build the thing' }));
    expect(createIssueFn).toHaveBeenNthCalledWith(2, expect.objectContaining({ title: 'TASK-1234.1: Create storage', parentId: 'p1' }));
  });

  it('updates only descriptions in update_existing mode', async () => {
    const searchIssuesFn = jest.fn()
      .mockResolvedValueOnce({ nodes: [{ id: 'p1', identifier: 'ENG-1', title: 'TASK-1234: Build the thing', state: { id: 's1', name: 'Todo' } }] } as never)
      .mockResolvedValueOnce({ nodes: [{ id: 'i1', identifier: 'ENG-2', title: 'TASK-1234.1: Create storage' }] } as never)
      .mockResolvedValueOnce({ nodes: [{ id: 'i2', identifier: 'ENG-3', title: 'TASK-1234.2: Wire API' }] } as never);
    const issueFn = jest.fn()
      .mockResolvedValueOnce({ id: 'p1', identifier: 'ENG-1', title: 'TASK-1234: Build the thing' } as never)
      .mockResolvedValueOnce({ id: 'i1', identifier: 'ENG-2', title: 'TASK-1234.1: Create storage' } as never)
      .mockResolvedValueOnce({ id: 'i2', identifier: 'ENG-3', title: 'TASK-1234.2: Wire API' } as never);
    const updateIssueFn = jest.fn()
      .mockResolvedValueOnce({ success: true, issue: Promise.resolve({ id: 'p1', identifier: 'ENG-1', title: 'TASK-1234: Build the thing' }) } as never)
      .mockResolvedValueOnce({ success: true, issue: Promise.resolve({ id: 'i1', identifier: 'ENG-2', title: 'TASK-1234.1: Create storage' }) } as never)
      .mockResolvedValueOnce({ success: true, issue: Promise.resolve({ id: 'i2', identifier: 'ENG-3', title: 'TASK-1234.2: Wire API' }) } as never);

    getLinearClientMock.mockReturnValue({ searchIssues: searchIssuesFn, issue: issueFn, updateIssue: updateIssueFn } as never);

    const result = await syncTaskFile({ teamId: 't1', taskFilePath, mode: 'update_existing', createSubtasks: true });

    expect(result.parent.action).toBe('updated');
    expect(result.subissues.map((subissue) => subissue.action)).toEqual(['updated', 'updated']);
    for (const call of updateIssueFn.mock.calls) {
      const updatePayload = call[1] as Record<string, unknown>;
      expect(updatePayload.description).toEqual(expect.any(String));
      expect(updatePayload.stateId).toBeUndefined();
      expect(updatePayload.assigneeId).toBeUndefined();
    }
  });

  it('creates dependency relations when linked dependencies are parsed', async () => {
    const searchIssuesFn = jest.fn()
      .mockResolvedValueOnce({ nodes: [{ id: 'p1', identifier: 'ENG-1', title: 'TASK-1234: Build the thing' }] } as never)
      .mockResolvedValueOnce({ nodes: [{ id: 'i1', identifier: 'ENG-2', title: 'TASK-1234.1: Create storage' }] } as never)
      .mockResolvedValueOnce({ nodes: [{ id: 'i2', identifier: 'ENG-3', title: 'TASK-1234.2: Wire API' }] } as never);
    const issueFn = jest.fn().mockImplementation(async (issueId: unknown) => {
      if (issueId === 'i1') return { id: 'i1', identifier: 'ENG-2', title: 'TASK-1234.1: Create storage' } as never;
      if (issueId === 'i2') return { id: 'i2', identifier: 'ENG-3', title: 'TASK-1234.2: Wire API' } as never;
      return { id: 'p1', identifier: 'ENG-1', title: 'TASK-1234: Build the thing' } as never;
    });
    const createIssueRelationFn = jest.fn().mockResolvedValue({
      success: true,
      issueRelation: Promise.resolve({ id: 'r1', type: 'blocks' }),
    } as never);

    getLinearClientMock.mockReturnValue({ searchIssues: searchIssuesFn, issue: issueFn, createIssueRelation: createIssueRelationFn } as never);

    const result = await syncTaskFile({ teamId: 't1', taskFilePath, mode: 'create_missing', createSubtasks: true, linkDependencies: true });

    expect(createIssueRelationFn).toHaveBeenCalledWith({ issueId: 'i1', relatedIssueId: 'i2', type: 'blocks' });
    expect(result.relations).toEqual([
      { action: 'unchanged', issueKey: 'TASK-1234.1', blockedBy: ['TASK-1234.0'] },
      { action: 'created', issueKey: 'TASK-1234.2', blockedBy: ['TASK-1234.1'] },
    ]);
  });

  it('visible output summarizes sync actions', async () => {
    const searchIssuesFn = jest.fn().mockResolvedValue({ nodes: [] } as never);
    getLinearClientMock.mockReturnValue({ searchIssues: searchIssuesFn } as never);

    const response = await linearSyncTaskFileTool.execute('tool-call-id', {
      teamId: 't1',
      taskFilePath,
      mode: 'dry_run',
    }, new AbortController().signal, undefined, {} as never);

    expect((response.content[0] as { text: string }).text).toContain('Synced task file');
    expect((response.content[0] as { text: string }).text).toContain('would_create');
    expect(response.details.parent.action).toBe('would_create');
  });
});
