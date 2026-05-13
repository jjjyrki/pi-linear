import { jest } from '@jest/globals';

const getLinearClientMock = jest.fn();

jest.unstable_mockModule('../src/client.js', () => ({
  getLinearClient: getLinearClientMock,
}));

const { LinearValidationError } = await import('../src/errors.js');
const { searchIssues, linearSearchIssuesTool } = await import('../src/tools/searchIssues.js');

describe('search issues tool', () => {
  beforeEach(() => {
    getLinearClientMock.mockReset();
  });

  it('validates required query and bounded pagination', async () => {
    await expect(searchIssues({ query: '   ' })).rejects.toThrow(LinearValidationError);
    await expect(searchIssues({ query: 'TASK-0009', first: 101 })).rejects.toThrow(/at most 100/i);
    await expect(searchIssues({ query: 'TASK-0009', includeArchived: 'yes' })).rejects.toThrow(/includeArchived/i);
  });

  it('searches issues with defaults, team filtering, and normalized parent output', async () => {
    const searchIssuesFn = jest.fn().mockResolvedValue({
      totalCount: 1,
      nodes: [{
        id: 'i1',
        identifier: 'ENG-1',
        title: 'TASK-0009 search issue',
        url: 'https://linear.app/issue/ENG-1',
        state: { id: 's1', name: 'Todo' },
        parent: { id: 'p1', identifier: 'ENG-0', title: 'Parent issue' },
      }],
      pageInfo: { hasNextPage: false, hasPreviousPage: false, endCursor: null, startCursor: null },
    } as never);

    getLinearClientMock.mockReturnValue({ searchIssues: searchIssuesFn } as never);

    const result = await searchIssues({ query: ' TASK-0009 ', teamId: 't1' });

    expect(searchIssuesFn).toHaveBeenCalledWith('TASK-0009', {
      first: 25,
      includeArchived: false,
      teamId: 't1',
    });
    expect(result.issues[0]).toMatchObject({
      id: 'i1',
      identifier: 'ENG-1',
      title: 'TASK-0009 search issue',
      url: 'https://linear.app/issue/ENG-1',
      state: { id: 's1', name: 'Todo' },
      parent: { id: 'p1', identifier: 'ENG-0', title: 'Parent issue' },
    });
    expect(result.totalCount).toBe(1);
  });

  it('passes includeArchived and first when requested', async () => {
    const searchIssuesFn = jest.fn().mockResolvedValue({ nodes: [] } as never);
    getLinearClientMock.mockReturnValue({ searchIssues: searchIssuesFn } as never);

    await searchIssues({ query: 'done task', includeArchived: true, first: 10 });

    expect(searchIssuesFn).toHaveBeenCalledWith('done task', {
      first: 10,
      includeArchived: true,
    });
  });

  it('visible output includes result identifiers, titles, IDs, and parent identifiers', async () => {
    getLinearClientMock.mockReturnValue({
      searchIssues: jest.fn().mockResolvedValue({
        nodes: [{
          id: 'i1',
          identifier: 'ENG-1',
          title: 'TASK-0009 search issue',
          url: 'https://linear.app/issue/ENG-1',
          parent: { id: 'p1', identifier: 'ENG-0' },
        }],
      } as never),
    } as never);

    const response = await linearSearchIssuesTool.execute('tool-call-id', { query: 'TASK-0009' }, new AbortController().signal, undefined, {} as never);
    const text = (response.content[0] as { text: string }).text;

    expect(text).toContain('Found 1 issues matching "TASK-0009"');
    expect(text).toContain('ENG-1: TASK-0009 search issue');
    expect(text).toContain('parent: ENG-0');
    expect(text).toContain('id: i1');
    expect(response.details.issues[0].id).toBe('i1');
  });
});
