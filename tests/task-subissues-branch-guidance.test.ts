import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { jest } from '@jest/globals';

const getLinearClientMock = jest.fn();

jest.unstable_mockModule('../src/client.js', () => ({
  getLinearClient: getLinearClientMock,
}));

const { parseTaskMarkdownContent } = await import('../src/taskFiles.js');
const {
  buildBaseBranchGuidance,
  buildPreferredBranchName,
  createTaskSubissuesFromMarkdown,
  linearCreateTaskSubissuesFromMarkdownTool,
} = await import('../src/tools/createTaskSubissuesFromMarkdown.js');

const taskMarkdown = `id: TASK-0067
status: todo
summary: Route webhook work

# Implementation sub-tasks
- [ ] TASK-0067.12: Create webhook-to-job enqueue path
  Persist jobs.
- [ ] TASK-0067.13: Implement job state machine
  - Dependencies: TASK-0067.12
  Track transitions.
`;

describe('task sub-issues branch guidance helper', () => {
  let tempDir: string;
  let taskFilePath: string;

  beforeEach(async () => {
    getLinearClientMock.mockReset();
    tempDir = await mkdtemp(path.join(os.tmpdir(), 'pi-linear-task-branches-'));
    taskFilePath = path.join(tempDir, 'TASK-0067.md');
    await writeFile(taskFilePath, taskMarkdown, 'utf8');
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('generates deterministic branch names and dependency-aware base guidance', () => {
    const parsed = parseTaskMarkdownContent(taskMarkdown, 'TASK-0067.md');

    expect(buildPreferredBranchName(parsed, parsed.subTasks[0], 'task-0067')).toBe('task-0067-12-create-webhook-to-job-enqueue-path');
    expect(buildBaseBranchGuidance(parsed.subTasks[0])).toBe('Base branch: latest `main`.');
    expect(buildBaseBranchGuidance(parsed.subTasks[1])).toBe('Base branch: latest `main` after TASK-0067.12 is merged.');
  });

  it('creates parsed sub-issues with branch guidance appended to descriptions', async () => {
    const searchIssuesFn = jest.fn().mockResolvedValue({
      nodes: [{ id: 'parent-1', identifier: 'LAT-42', title: 'TASK-0067: Route webhook work' }],
    } as never);
    const issueFn = jest.fn().mockResolvedValue({ id: 'parent-1', identifier: 'LAT-42', title: 'TASK-0067: Route webhook work' } as never);
    const createIssueFn = jest.fn()
      .mockResolvedValueOnce({
        success: true,
        issue: Promise.resolve({ id: 'i1', identifier: 'LAT-54', title: 'TASK-0067.12: Create webhook-to-job enqueue path' }),
      } as never)
      .mockResolvedValueOnce({
        success: true,
        issue: Promise.resolve({ id: 'i2', identifier: 'LAT-55', title: 'TASK-0067.13: Implement job state machine' }),
      } as never);

    getLinearClientMock.mockReturnValue({ searchIssues: searchIssuesFn, issue: issueFn, createIssue: createIssueFn } as never);

    const result = await createTaskSubissuesFromMarkdown({
      teamId: 'team-1',
      taskFilePath,
      branchPrefix: 'task-0067',
      includeBranchGuidance: true,
    });

    expect(result.subissues.map((subissue) => subissue.preferredBranch)).toEqual([
      'task-0067-12-create-webhook-to-job-enqueue-path',
      'task-0067-13-implement-job-state-machine',
    ]);
    expect(result.subissues[1].baseBranchGuidance).toBe('Base branch: latest `main` after TASK-0067.12 is merged.');
    expect(createIssueFn).toHaveBeenNthCalledWith(1, expect.objectContaining({
      parentId: 'parent-1',
      title: 'TASK-0067.12: Create webhook-to-job enqueue path',
      description: expect.stringContaining('Branch order / PR guidance:'),
    }));
    expect(createIssueFn).toHaveBeenNthCalledWith(2, expect.objectContaining({
      parentId: 'parent-1',
      description: expect.stringContaining('Preferred branch: `task-0067-13-implement-job-state-machine`'),
    }));
    expect(result.subissues.map((subissue) => subissue.issue.identifier)).toEqual(['LAT-54', 'LAT-55']);
  });

  it('omits branch guidance when requested and validates branch prefixes', async () => {
    const searchIssuesFn = jest.fn().mockResolvedValue({
      nodes: [{ id: 'parent-1', identifier: 'LAT-42', title: 'TASK-0067: Route webhook work' }],
    } as never);
    const issueFn = jest.fn().mockResolvedValue({ id: 'parent-1', identifier: 'LAT-42', title: 'TASK-0067: Route webhook work' } as never);
    const createIssueFn = jest.fn().mockResolvedValue({
      success: true,
      issue: Promise.resolve({ id: 'i1', identifier: 'LAT-54', title: 'TASK-0067.12: Create webhook-to-job enqueue path' }),
    } as never);
    getLinearClientMock.mockReturnValue({ searchIssues: searchIssuesFn, issue: issueFn, createIssue: createIssueFn } as never);

    await expect(createTaskSubissuesFromMarkdown({
      teamId: 'team-1',
      taskFilePath,
      branchPrefix: 'bad prefix',
    })).rejects.toThrow(/branchPrefix/i);

    await createTaskSubissuesFromMarkdown({
      teamId: 'team-1',
      taskFilePath,
      branchPrefix: 'task-0067',
      includeBranchGuidance: false,
    });

    const firstPayload = createIssueFn.mock.calls[0][0] as Record<string, unknown>;
    expect(firstPayload.description).not.toContain('Branch order / PR guidance');
  });

  it('visible output includes created identifiers and preferred branches', async () => {
    getLinearClientMock.mockReturnValue({
      searchIssues: jest.fn().mockResolvedValue({
        nodes: [{ id: 'parent-1', identifier: 'LAT-42', title: 'TASK-0067: Route webhook work' }],
      } as never),
      issue: jest.fn().mockResolvedValue({ id: 'parent-1', identifier: 'LAT-42', title: 'TASK-0067: Route webhook work' } as never),
      createIssue: jest.fn()
        .mockResolvedValueOnce({
          success: true,
          issue: Promise.resolve({ id: 'i1', identifier: 'LAT-54', title: 'TASK-0067.12: Create webhook-to-job enqueue path' }),
        } as never)
        .mockResolvedValueOnce({
          success: true,
          issue: Promise.resolve({ id: 'i2', identifier: 'LAT-55', title: 'TASK-0067.13: Implement job state machine' }),
        } as never),
    } as never);

    const response = await linearCreateTaskSubissuesFromMarkdownTool.execute('tool-call-id', {
      teamId: 'team-1',
      taskFilePath,
      branchPrefix: 'task-0067',
    }, new AbortController().signal, undefined, {} as never);
    const text = (response.content[0] as { text: string }).text;

    expect(text).toContain('LAT-54');
    expect(text).toContain('task-0067-12-create-webhook-to-job-enqueue-path');
    expect(response.details.subissues[0].issue.id).toBe('i1');
  });
});
