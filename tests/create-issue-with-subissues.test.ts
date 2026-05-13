import { jest } from '@jest/globals';

const getLinearClientMock = jest.fn();

jest.unstable_mockModule('../src/client.js', () => ({
  getLinearClient: getLinearClientMock,
}));

const { createIssueWithSubissues, linearCreateIssueWithSubissuesTool } = await import('../src/tools/createIssueWithSubissues.js');

describe('create issue with sub-issues tool', () => {
  beforeEach(() => {
    getLinearClientMock.mockReset();
  });

  it('creates a parent issue and sub-issues in input order', async () => {
    const createIssueFn = jest.fn()
      .mockResolvedValueOnce({
        success: true,
        issue: Promise.resolve({ id: 'p1', identifier: 'ENG-1', title: 'Parent issue' }),
      } as never)
      .mockResolvedValueOnce({
        success: true,
        issue: Promise.resolve({ id: 'c1', identifier: 'ENG-2', title: 'First sub-issue', parent: { id: 'p1', identifier: 'ENG-1' } }),
      } as never)
      .mockResolvedValueOnce({
        success: true,
        issue: Promise.resolve({ id: 'c2', identifier: 'ENG-3', title: 'Second sub-issue', parent: { id: 'p1', identifier: 'ENG-1' } }),
      } as never);

    getLinearClientMock.mockReturnValue({ createIssue: createIssueFn } as never);

    const result = await createIssueWithSubissues({
      teamId: 't1',
      parent: { title: 'Parent issue', description: 'Parent body' },
      subissues: [{ title: 'First sub-issue' }, { title: 'Second sub-issue' }],
    });

    expect(createIssueFn).toHaveBeenNthCalledWith(1, expect.objectContaining({ teamId: 't1', title: 'Parent issue' }));
    expect(createIssueFn).toHaveBeenNthCalledWith(2, expect.objectContaining({ teamId: 't1', title: 'First sub-issue', parentId: 'p1' }));
    expect(createIssueFn).toHaveBeenNthCalledWith(3, expect.objectContaining({ teamId: 't1', title: 'Second sub-issue', parentId: 'p1' }));
    expect(result.parent.identifier).toBe('ENG-1');
    expect(result.subissues.map((issue) => issue.identifier)).toEqual(['ENG-2', 'ENG-3']);
  });

  it('rejects invalid input before creating the parent', async () => {
    const createIssueFn = jest.fn();
    getLinearClientMock.mockReturnValue({ createIssue: createIssueFn } as never);

    await expect(createIssueWithSubissues({ teamId: 't1', parent: { title: '   ' }, subissues: [{ title: 'Child' }] })).rejects.toThrow(/title/i);
    await expect(createIssueWithSubissues({ teamId: 't1', parent: { title: 'Parent' }, subissues: [] })).rejects.toThrow(/subissues/i);
    await expect(createIssueWithSubissues({ teamId: 't1', parent: { title: 'Parent' }, subissues: [{ title: 'Child' }, { title: '' }] })).rejects.toThrow(/title/i);

    expect(createIssueFn).not.toHaveBeenCalled();
  });

  it('includes parent and created sub-issue context when a sub-issue fails', async () => {
    const createIssueFn = jest.fn()
      .mockResolvedValueOnce({
        success: true,
        issue: Promise.resolve({ id: 'p1', identifier: 'ENG-1', title: 'Parent issue' }),
      } as never)
      .mockResolvedValueOnce({
        success: true,
        issue: Promise.resolve({ id: 'c1', identifier: 'ENG-2', title: 'First sub-issue' }),
      } as never)
      .mockResolvedValueOnce({ success: false } as never);

    getLinearClientMock.mockReturnValue({ createIssue: createIssueFn } as never);

    await expect(createIssueWithSubissues({
      teamId: 't1',
      parent: { title: 'Parent issue' },
      subissues: [{ title: 'First sub-issue' }, { title: 'Second sub-issue' }],
    })).rejects.toThrow(/Failed to create sub-issue 2 \(Second sub-issue\) under ENG-1.*ENG-2/i);
  });

  it('visible output includes the parent and all sub-issue IDs', async () => {
    getLinearClientMock.mockReturnValue({
      createIssue: jest.fn()
        .mockResolvedValueOnce({
          success: true,
          issue: Promise.resolve({ id: 'p1', identifier: 'ENG-1', title: 'Parent issue' }),
        } as never)
        .mockResolvedValueOnce({
          success: true,
          issue: Promise.resolve({ id: 'c1', identifier: 'ENG-2', title: 'First sub-issue' }),
        } as never),
    } as never);

    const response = await linearCreateIssueWithSubissuesTool.execute('tool-call-id', {
      teamId: 't1',
      parent: { title: 'Parent issue' },
      subissues: [{ title: 'First sub-issue' }],
    }, new AbortController().signal, undefined, {} as never);
    const text = (response.content[0] as { text: string }).text;

    expect(text).toContain('Created parent ENG-1: Parent issue (id: p1)');
    expect(text).toContain('ENG-2: First sub-issue (id: c1)');
    expect(response.details.parent.id).toBe('p1');
    expect(response.details.subissues[0].id).toBe('c1');
  });
});
