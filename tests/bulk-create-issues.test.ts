import { jest } from '@jest/globals';

const getLinearClientMock = jest.fn();

jest.unstable_mockModule('../src/client.js', () => ({
  getLinearClient: getLinearClientMock,
}));

const { createIssues, linearCreateIssuesTool } = await import('../src/tools/createIssues.js');

describe('bulk create issues tool', () => {
  beforeEach(() => {
    getLinearClientMock.mockReset();
  });

  it('creates multiple issues sequentially and preserves input order', async () => {
    const createIssueFn = jest.fn()
      .mockResolvedValueOnce({
        success: true,
        issue: Promise.resolve({ id: 'i1', identifier: 'ENG-1', title: 'First issue' }),
      } as never)
      .mockResolvedValueOnce({
        success: true,
        issue: Promise.resolve({ id: 'i2', identifier: 'ENG-2', title: 'Second issue' }),
      } as never);

    getLinearClientMock.mockReturnValue({ createIssue: createIssueFn } as never);

    const result = await createIssues({
      teamId: 't1',
      issues: [
        { title: 'First issue', priority: 'high' },
        { title: 'Second issue', stateId: 's1', assigneeId: 'u1' },
      ],
    });

    expect(createIssueFn).toHaveBeenNthCalledWith(1, expect.objectContaining({ teamId: 't1', title: 'First issue', priority: 2 }));
    expect(createIssueFn).toHaveBeenNthCalledWith(2, expect.objectContaining({ teamId: 't1', title: 'Second issue', stateId: 's1', assigneeId: 'u1' }));
    expect(result.issues.map((issue) => issue.identifier)).toEqual(['ENG-1', 'ENG-2']);
  });

  it('resolves parent references before creating issues', async () => {
    const issueFn = jest.fn().mockResolvedValue({ id: 'parent-1', identifier: 'ENG-10', title: 'Parent issue' } as never);
    const createIssueFn = jest.fn().mockResolvedValue({
      success: true,
      issue: Promise.resolve({ id: 'i1', identifier: 'ENG-11', title: 'Child issue', parent: { id: 'parent-1', identifier: 'ENG-10' } }),
    } as never);

    getLinearClientMock.mockReturnValue({ issue: issueFn, createIssue: createIssueFn } as never);

    const result = await createIssues({ teamId: 't1', issues: [{ title: 'Child issue', parentId: 'ENG-10' }] });

    expect(issueFn).toHaveBeenCalledWith('ENG-10');
    expect(createIssueFn).toHaveBeenCalledWith(expect.objectContaining({ parentId: 'parent-1' }));
    expect(result.issues[0].parent).toEqual({ id: 'parent-1', identifier: 'ENG-10' });
  });

  it('rejects invalid input before creating the first issue', async () => {
    const createIssueFn = jest.fn();
    getLinearClientMock.mockReturnValue({ createIssue: createIssueFn } as never);

    await expect(createIssues({ teamId: 't1', issues: [] })).rejects.toThrow(/issues must be a non-empty array/i);
    await expect(createIssues({ teamId: 't1', issues: [{ title: 'Valid' }, { title: '   ' }] })).rejects.toThrow(/title/i);

    expect(createIssueFn).not.toHaveBeenCalled();
  });

  it('includes issue context when a later create fails', async () => {
    const createIssueFn = jest.fn()
      .mockResolvedValueOnce({
        success: true,
        issue: Promise.resolve({ id: 'i1', identifier: 'ENG-1', title: 'First issue' }),
      } as never)
      .mockResolvedValueOnce({ success: false } as never);

    getLinearClientMock.mockReturnValue({ createIssue: createIssueFn } as never);

    await expect(createIssues({
      teamId: 't1',
      issues: [{ title: 'First issue' }, { title: 'Second issue' }],
    })).rejects.toThrow(/Failed to create issue 2 \(Second issue\).*ENG-1/i);
  });

  it('visible output includes all created identifiers and IDs', async () => {
    getLinearClientMock.mockReturnValue({
      createIssue: jest.fn()
        .mockResolvedValueOnce({
          success: true,
          issue: Promise.resolve({ id: 'i1', identifier: 'ENG-1', title: 'First issue' }),
        } as never)
        .mockResolvedValueOnce({
          success: true,
          issue: Promise.resolve({ id: 'i2', identifier: 'ENG-2', title: 'Second issue' }),
        } as never),
    } as never);

    const response = await linearCreateIssuesTool.execute('tool-call-id', {
      teamId: 't1',
      issues: [{ title: 'First issue' }, { title: 'Second issue' }],
    }, new AbortController().signal, undefined, {} as never);
    const text = (response.content[0] as { text: string }).text;

    expect(text).toContain('Created 2 issues:');
    expect(text).toContain('ENG-1: First issue (id: i1)');
    expect(text).toContain('ENG-2: Second issue (id: i2)');
    expect(response.details.issues.map((issue) => issue.id)).toEqual(['i1', 'i2']);
  });
});
