import { jest } from '@jest/globals';

const getLinearClientMock = jest.fn();

jest.unstable_mockModule('../src/client.js', () => ({
  getLinearClient: getLinearClientMock,
}));

const { LinearValidationError } = await import('../src/errors.js');
const { createIssue, linearCreateIssueTool } = await import('../src/tools/createIssue.js');
const { readIssue } = await import('../src/tools/readIssue.js');
const { listIssues } = await import('../src/tools/listIssues.js');
const { updateIssue, buildIssueUpdateInput } = await import('../src/tools/updateIssue.js');
const { assignIssue } = await import('../src/tools/assignIssue.js');

describe('issue tools', () => {
  beforeEach(() => {
    getLinearClientMock.mockReset();
  });

  it('creates an issue with normalized output', async () => {
    getLinearClientMock.mockReturnValue({
      createIssue: jest.fn().mockResolvedValue({
        success: true,
        issue: Promise.resolve({ id: 'i1', identifier: 'ENG-1', title: 'Bug fix' }),
      } as never),
    } as never);

    const issue = await createIssue({ teamId: 't1', title: 'Bug fix', priority: 'high' });
    expect(issue).toMatchObject({ id: 'i1', identifier: 'ENG-1', title: 'Bug fix' });
  });

  it('creates a sub-issue when a parent issue is supplied', async () => {
    const issueFn = jest
      .fn()
      .mockResolvedValueOnce({ id: 'parent-1', identifier: 'ENG-10', title: 'Parent issue' } as never);
    const createIssueFn = jest.fn().mockResolvedValue({
      success: true,
      issue: Promise.resolve({ id: 'i1', identifier: 'ENG-11', title: 'Child issue' }),
    } as never);

    getLinearClientMock.mockReturnValue({ issue: issueFn, createIssue: createIssueFn } as never);

    await createIssue({ teamId: 't1', title: 'Child issue', parentId: 'ENG-10' });

    expect(issueFn).toHaveBeenCalledWith('ENG-10');
    expect(createIssueFn).toHaveBeenCalledWith(expect.objectContaining({ parentId: 'parent-1' }));
  });

  it('rejects invalid create input and failed mutations', async () => {
    await expect(createIssue({ teamId: ' ', title: 'ok' })).rejects.toThrow(/teamId/i);
    await expect(createIssue({ teamId: 't1', title: '   ' })).rejects.toThrow(/title/i);
    await expect(createIssue({ teamId: 't1', title: 'ok', estimate: Number.NaN })).rejects.toThrow(/finite number/i);

    getLinearClientMock.mockReturnValue({
      createIssue: jest.fn().mockResolvedValue({ success: false } as never),
    } as never);
    await expect(createIssue({ teamId: 't1', title: 'Bug fix' })).rejects.toThrow(/Failed to create/);
  });

  it('reads issue by identifier and includes description', async () => {
    const issueFn = jest
      .fn()
      .mockResolvedValueOnce({ id: 'i1', identifier: 'ENG-1', title: 'Bug fix', description: 'details' } as never);

    getLinearClientMock.mockReturnValue({ issue: issueFn } as never);

    const issue = await readIssue({ issueId: 'ENG-1' });
    expect(issue.description).toBe('details');
    expect(issueFn).toHaveBeenCalledTimes(1);
    expect(issueFn).toHaveBeenCalledWith('ENG-1');
  });

  it('rejects invalid read input and missing issue', async () => {
    await expect(readIssue({ issueId: '   ' })).rejects.toThrow(/issueId/i);

    const issueFn = jest.fn().mockResolvedValueOnce(undefined as never);
    getLinearClientMock.mockReturnValue({ issue: issueFn } as never);

    await expect(readIssue({ issueId: 'ENG-1' })).rejects.toThrow(/Issue not found/);
  });

  it('lists open issues updated-first with bounded pagination', async () => {
    const issuesFn = jest.fn().mockResolvedValue({
      nodes: [{ id: 'i1', identifier: 'ENG-1', title: 'A' }],
      pageInfo: { hasNextPage: false, hasPreviousPage: false, endCursor: null, startCursor: null },
    } as never);
    getLinearClientMock.mockReturnValue({ issues: issuesFn } as never);

    const result = await listIssues({ first: 25 });
    expect(result.nodes).toHaveLength(1);

    const args = issuesFn.mock.calls[0][0] as Record<string, unknown>;
    expect(args.orderBy).toBe('updatedAt');
    expect(args.filter).toMatchObject({ archivedAt: { null: true }, state: { type: { nin: ['completed', 'canceled'] } } });

    await expect(listIssues({ first: 101 })).rejects.toThrow(/at most 100/i);
  });

  it('applies list filters and validates optional strings', async () => {
    const issuesFn = jest.fn().mockResolvedValue({
      nodes: [],
      pageInfo: { hasNextPage: false, hasPreviousPage: false },
    } as never);
    getLinearClientMock.mockReturnValue({ issues: issuesFn } as never);

    await listIssues({ teamId: 't1', assigneeId: 'u1', stateId: 's1', after: 'cursor' });
    expect(issuesFn.mock.calls[0][0]).toMatchObject({
      after: 'cursor',
      filter: {
        team: { id: { eq: 't1' } },
        assignee: { id: { eq: 'u1' } },
        state: { id: { eq: 's1' } },
      },
    });

    await expect(listIssues({ after: '   ' })).rejects.toThrow(/after/i);
  });

  it('updates issue and rejects no-op updates', async () => {
    const issueFn = jest.fn().mockResolvedValue({ id: 'i1', identifier: 'ENG-1', title: 'A' } as never);
    const updateIssueFn = jest.fn().mockResolvedValue({
      success: true,
      issue: Promise.resolve({ id: 'i1', identifier: 'ENG-1', title: 'Updated' }),
    } as never);

    getLinearClientMock.mockReturnValue({ issue: issueFn, updateIssue: updateIssueFn } as never);

    const issue = await updateIssue({ issueId: 'ENG-1', title: 'Updated' });
    expect(issue.title).toBe('Updated');
    expect(updateIssueFn).toHaveBeenCalledWith('i1', {
      title: 'Updated',
      description: undefined,
      stateId: undefined,
      assigneeId: undefined,
      labelIds: undefined,
      estimate: undefined,
      dueDate: undefined,
      priority: undefined,
    });

    expect(() => buildIssueUpdateInput({ issueId: 'ENG-1' })).toThrow(LinearValidationError);
  });

  it('reparents and clears parent issues through update path', async () => {
    const issueFn = jest.fn().mockImplementation(async (issueReference: unknown) => {
      if (issueReference === 'ENG-10') {
        return { id: 'parent-1', identifier: 'ENG-10', title: 'Parent issue' } as never;
      }
      return { id: 'i1', identifier: 'ENG-1', title: 'A' } as never;
    });
    const updateIssueFn = jest.fn().mockResolvedValue({
      success: true,
      issue: Promise.resolve({ id: 'i1', identifier: 'ENG-1', title: 'A' }),
    } as never);

    getLinearClientMock.mockReturnValue({ issue: issueFn, updateIssue: updateIssueFn } as never);

    await updateIssue({ issueId: 'ENG-1', parentId: 'ENG-10' });
    await updateIssue({ issueId: 'ENG-1', parentId: null });

    expect(issueFn).toHaveBeenNthCalledWith(1, 'ENG-1');
    expect(issueFn).toHaveBeenNthCalledWith(2, 'ENG-10');
    expect(issueFn).toHaveBeenNthCalledWith(3, 'ENG-1');
    expect(updateIssueFn).toHaveBeenNthCalledWith(1, 'i1', expect.objectContaining({ parentId: 'parent-1' }));
    expect(updateIssueFn).toHaveBeenNthCalledWith(2, 'i1', expect.objectContaining({ parentId: null }));
  });

  it('validates update field rules and surfaces mutation failures', async () => {
    expect(() => buildIssueUpdateInput({ issueId: 'ENG-1', stateId: null })).toThrow(/stateId cannot be null/i);
    expect(() => buildIssueUpdateInput({ issueId: 'ENG-1', description: '   ' })).toThrow(/description/i);
    expect(() => buildIssueUpdateInput({ issueId: 'ENG-1', estimate: Number.POSITIVE_INFINITY })).toThrow(/finite number/i);

    const issueFn = jest.fn().mockResolvedValue({ id: 'i1', identifier: 'ENG-1', title: 'A' } as never);
    const updateIssueFn = jest.fn().mockResolvedValue({ success: false } as never);
    getLinearClientMock.mockReturnValue({ issue: issueFn, updateIssue: updateIssueFn } as never);

    await expect(updateIssue({ issueId: 'ENG-1', title: 'Updated' })).rejects.toThrow(/Failed to update/);
  });

  it('assigns and unassigns through update path', async () => {
    const issueFn = jest.fn().mockResolvedValue({ id: 'i1', identifier: 'ENG-1', title: 'A' } as never);
    const updateIssueFn = jest.fn().mockResolvedValue({
      success: true,
      issue: Promise.resolve({ id: 'i1', identifier: 'ENG-1', title: 'A', assigneeId: 'u1' }),
    } as never);
    getLinearClientMock.mockReturnValue({ issue: issueFn, updateIssue: updateIssueFn } as never);

    await assignIssue({ issueId: 'ENG-1', assigneeId: 'u1' });
    await assignIssue({ issueId: 'ENG-1' });

    expect(updateIssueFn).toHaveBeenNthCalledWith(1, 'i1', expect.objectContaining({ assigneeId: 'u1' }));
    expect(updateIssueFn).toHaveBeenNthCalledWith(2, 'i1', expect.objectContaining({ assigneeId: null }));
  });

  it('assign tool summarizes assigned and unassigned responses', async () => {
    const issueFn = jest.fn().mockResolvedValue({ id: 'i1', identifier: 'ENG-1', title: 'A' } as never);
    const updateIssueFn = jest.fn().mockResolvedValue({
      success: true,
      issue: Promise.resolve({ id: 'i1', identifier: 'ENG-1', title: 'A' }),
    } as never);
    getLinearClientMock.mockReturnValue({ issue: issueFn, updateIssue: updateIssueFn } as never);

    const { linearAssignIssueTool } = await import('../src/tools/assignIssue.js');
    const assigned = await linearAssignIssueTool.execute('tool-call-id', { issueId: 'ENG-1', assigneeId: 'u1' }, new AbortController().signal, undefined, {} as never);
    const unassigned = await linearAssignIssueTool.execute('tool-call-id', { issueId: 'ENG-1' }, new AbortController().signal, undefined, {} as never);

    expect((assigned.content[0] as { text: string }).text).toMatch(/Assigned/);
    expect((unassigned.content[0] as { text: string }).text).toMatch(/Unassigned/);
  });

  it('tool output uses content + details contract', async () => {
    getLinearClientMock.mockReturnValue({
      createIssue: jest.fn().mockResolvedValue({
        success: true,
        issue: Promise.resolve({ id: 'i1', identifier: 'ENG-1', title: 'Bug fix' }),
      } as never),
    } as never);

    const response = await linearCreateIssueTool.execute('tool-call-id', { teamId: 't1', title: 'Bug fix' }, new AbortController().signal, undefined, {} as never);
    expect((response.content[0] as { text: string }).text).toMatch(/Created ENG-1/);
    expect(response.details.issue.identifier).toBe('ENG-1');
  });
});
