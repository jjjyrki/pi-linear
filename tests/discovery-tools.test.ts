import { jest } from '@jest/globals';

const getLinearClientMock = jest.fn();

jest.unstable_mockModule('../src/client.js', () => ({
  getLinearClient: getLinearClientMock,
}));

const { LinearValidationError } = await import('../src/errors.js');
const { viewLinearUser, linearViewerTool } = await import('../src/tools/viewer.js');
const { listLinearTeams, linearListTeamsTool } = await import('../src/tools/listTeams.js');
const { listLinearUsers, linearListUsersTool } = await import('../src/tools/listUsers.js');
const { listLinearWorkflowStates, linearListWorkflowStatesTool } = await import('../src/tools/listWorkflowStates.js');

describe('discovery tools', () => {
  beforeEach(() => {
    getLinearClientMock.mockReset();
  });

  it('reads the authenticated viewer with normalized fields', async () => {
    getLinearClientMock.mockReturnValue({ viewer: Promise.resolve({
      id: 'u1',
      displayName: 'Ada Lovelace',
      name: 'Ada',
      email: 'ada@example.com',
    } as never) } as never);

    const result = await viewLinearUser();
    expect(result.viewer).toEqual({
      id: 'u1',
      displayName: 'Ada Lovelace',
      name: 'Ada',
      email: 'ada@example.com',
    });

    const response = await linearViewerTool.execute('tool-call-id', {}, new AbortController().signal, undefined, {} as never);
    expect((response.content[0] as { text: string }).text).toContain('Ada Lovelace');
    expect(response.details.viewer.email).toBe('ada@example.com');
  });

  it('lists teams with default pagination and validation bounds', async () => {
    const teamsFn = jest.fn().mockResolvedValue({
      nodes: [
        { id: 't1', key: 'ENG', name: 'Engineering' },
        { id: 't2', key: 'OPS', name: 'Operations' },
      ],
      pageInfo: { hasNextPage: false, hasPreviousPage: false, endCursor: 'cursor-2', startCursor: 'cursor-1' },
    } as never);

    getLinearClientMock.mockReturnValue({ teams: teamsFn } as never);

    const result = await listLinearTeams({});

    expect(teamsFn).toHaveBeenCalledWith({ first: 25, after: undefined });
    expect(result.teams).toEqual([
      { id: 't1', key: 'ENG', name: 'Engineering' },
      { id: 't2', key: 'OPS', name: 'Operations' },
    ]);
    expect(result.pageInfo).toMatchObject({ hasNextPage: false, endCursor: 'cursor-2' });

    await expect(listLinearTeams({ first: 101 })).rejects.toThrow(/at most 100/i);

    const response = await linearListTeamsTool.execute('tool-call-id', {}, new AbortController().signal, undefined, {} as never);
    const text = (response.content[0] as { text: string }).text;
    expect(text).toContain('Found 2 teams:');
    expect(text).toContain('ENG — Engineering (id: t1)');
    expect(text).toContain('OPS — Operations (id: t2)');
    expect(response.details.teams[0]).toMatchObject({ id: 't1', key: 'ENG', name: 'Engineering' });
  });

  it('lists teams with IDs when optional SDK fields are missing', async () => {
    const teamsFn = jest.fn().mockResolvedValue({
      nodes: [{ id: 't1' }],
      pageInfo: { hasNextPage: false, hasPreviousPage: false },
    } as never);

    getLinearClientMock.mockReturnValue({ teams: teamsFn } as never);

    const response = await linearListTeamsTool.execute('tool-call-id', {}, new AbortController().signal, undefined, {} as never);
    const text = (response.content[0] as { text: string }).text;
    expect(text).toContain('Unnamed team (id: t1)');
    expect(response.details.teams[0]).toEqual({ id: 't1' });
  });

  it('lists users with optional query filtering and pagination validation', async () => {
    const usersFn = jest.fn().mockResolvedValue({
      nodes: [
        { id: 'u1', displayName: 'Ada Lovelace', name: 'Ada', email: 'ada@example.com' },
        { id: 'u2', name: 'Grace Hopper' },
      ],
      pageInfo: { hasNextPage: true, hasPreviousPage: false, endCursor: 'cursor-2', startCursor: 'cursor-1' },
    } as never);

    getLinearClientMock.mockReturnValue({ users: usersFn } as never);

    const queryResult = await listLinearUsers({ query: 'ada', first: 10, after: 'cursor-1' });
    expect(usersFn).toHaveBeenCalledWith({ query: 'ada', first: 10, after: 'cursor-1' });
    expect(queryResult.users[0]).toEqual({
      id: 'u1',
      displayName: 'Ada Lovelace',
      name: 'Ada',
      email: 'ada@example.com',
    });

    const noQueryResult = await listLinearUsers({ first: 25 });
    expect(usersFn).toHaveBeenLastCalledWith({ first: 25, after: undefined });
    expect(noQueryResult.users[1]).toEqual({ id: 'u2', name: 'Grace Hopper' });

    await expect(listLinearUsers({ query: '   ' })).rejects.toThrow(LinearValidationError);
    await expect(listLinearUsers({ first: 101 })).rejects.toThrow(/at most 100/i);

    const response = await linearListUsersTool.execute('tool-call-id', { query: 'ada' }, new AbortController().signal, undefined, {} as never);
    expect((response.content[0] as { text: string }).text).toMatch(/matching "ada"/i);
    expect(response.details.users).toHaveLength(2);
  });

  it('lists workflow states across pages with team summaries', async () => {
    const workflowStatesFn = jest.fn()
      .mockResolvedValueOnce({
        nodes: [
          { id: 's1', name: 'Todo', type: 'backlog', team: { id: 't1', key: 'ENG', name: 'Engineering' } },
          { id: 's2', name: 'In Progress', type: 'started', teamId: { id: 't1', key: 'ENG', name: 'Engineering' } },
        ],
        pageInfo: { hasNextPage: true, hasPreviousPage: false, endCursor: 'cursor-2', startCursor: 'cursor-1' },
      } as never)
      .mockResolvedValueOnce({
        nodes: [
          { id: 's3', name: 'Done', type: 'completed', team: { id: 't2', key: 'OPS', name: 'Operations' } },
        ],
        pageInfo: { hasNextPage: false, hasPreviousPage: true, endCursor: 'cursor-3', startCursor: 'cursor-3' },
      } as never);

    getLinearClientMock.mockReturnValue({ workflowStates: workflowStatesFn } as never);

    const result = await listLinearWorkflowStates();

    expect(workflowStatesFn).toHaveBeenCalledTimes(2);
    expect(result.workflowStates).toEqual([
      { id: 's1', name: 'Todo', type: 'backlog', team: { id: 't1', key: 'ENG', name: 'Engineering' } },
      { id: 's2', name: 'In Progress', type: 'started', team: { id: 't1', key: 'ENG', name: 'Engineering' } },
      { id: 's3', name: 'Done', type: 'completed', team: { id: 't2', key: 'OPS', name: 'Operations' } },
    ]);
    expect(result.truncated).toBe(false);

    workflowStatesFn.mockResolvedValue({
      nodes: [
        { id: 's1', name: 'Todo', type: 'backlog', team: { id: 't1', key: 'ENG', name: 'Engineering' } },
        { id: 's2', name: 'In Progress', type: 'started', teamId: { id: 't1', key: 'ENG', name: 'Engineering' } },
        { id: 's3', name: 'Done', type: 'completed', team: { id: 't2', key: 'OPS', name: 'Operations' } },
      ],
      pageInfo: { hasNextPage: false, hasPreviousPage: false, endCursor: 'cursor-3', startCursor: 'cursor-1' },
    } as never);

    const response = await linearListWorkflowStatesTool.execute('tool-call-id', {}, new AbortController().signal, undefined, {} as never);
    expect((response.content[0] as { text: string }).text).toBe('Found 3 workflow states');
    expect(response.details.truncated).toBe(false);
    expect(response.details.workflowStates[0].name).toBe('Todo');
  });

  it('marks workflow state responses as truncated when page cap is reached', async () => {
    const workflowStatesFn = jest.fn().mockResolvedValue({
      nodes: [{ id: 's1', name: 'Todo', type: 'backlog' }],
      pageInfo: { hasNextPage: true, hasPreviousPage: false, endCursor: 'cursor-next', startCursor: 'cursor-start' },
    } as never);

    getLinearClientMock.mockReturnValue({ workflowStates: workflowStatesFn } as never);

    const result = await listLinearWorkflowStates();
    expect(workflowStatesFn).toHaveBeenCalledTimes(10);
    expect(result.truncated).toBe(true);

    const response = await linearListWorkflowStatesTool.execute('tool-call-id', {}, new AbortController().signal, undefined, {} as never);
    expect((response.content[0] as { text: string }).text).toContain('truncated at 1000');
    expect(response.details.truncated).toBe(true);
  });
});
