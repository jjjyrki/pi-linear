import { jest } from '@jest/globals';

const getLinearClientMock = jest.fn();

jest.unstable_mockModule('../src/client.js', () => ({
  getLinearClient: getLinearClientMock,
}));

const { LinearValidationError } = await import('../src/errors.js');
const { createComment, linearCreateCommentTool } = await import('../src/tools/createComment.js');
const { listComments, linearListCommentsTool } = await import('../src/tools/listComments.js');

describe('comment tools', () => {
  beforeEach(() => {
    getLinearClientMock.mockReset();
  });

  it('creates comments and threaded replies with normalized issue details', async () => {
    const issueFn = jest.fn().mockResolvedValue({ id: 'i1', identifier: 'ENG-1', title: 'Bug fix' } as never);
    const createCommentFn = jest.fn().mockResolvedValue({
      success: true,
      comment: Promise.resolve({
        id: 'c1',
        body: 'Looks good',
        url: 'https://linear.app/acme/issue/ENG-1/comment/c1',
        parentId: 'c0',
        issueId: 'i1',
        user: { id: 'u1', displayName: 'Ada' },
        createdAt: '2026-04-29T00:00:00.000Z',
        updatedAt: '2026-04-29T00:01:00.000Z',
        editedAt: null,
      }),
    } as never);

    getLinearClientMock.mockReturnValue({ issue: issueFn, createComment: createCommentFn } as never);

    const result = await createComment({ issueId: 'ENG-1', body: 'Looks good', parentId: 'c0' });

    expect(issueFn).toHaveBeenCalledWith('ENG-1');
    expect(createCommentFn).toHaveBeenCalledWith({ issueId: 'i1', body: 'Looks good', parentId: 'c0' });
    expect(result.comment).toMatchObject({
      id: 'c1',
      body: 'Looks good',
      parentId: 'c0',
      url: 'https://linear.app/acme/issue/ENG-1/comment/c1',
      issue: { id: 'i1', identifier: 'ENG-1', title: 'Bug fix' },
      user: { id: 'u1', displayName: 'Ada' },
    });
  });

  it('rejects empty comment bodies and failed mutations', async () => {
    await expect(createComment({ issueId: 'ENG-1', body: '   ' })).rejects.toThrow(/body/i);

    const issueFn = jest.fn().mockResolvedValue({ id: 'i1', identifier: 'ENG-1', title: 'Bug fix' } as never);
    const createCommentFn = jest.fn().mockResolvedValue({ success: false } as never);
    getLinearClientMock.mockReturnValue({ issue: issueFn, createComment: createCommentFn } as never);

    await expect(createComment({ issueId: 'ENG-1', body: 'Looks good' })).rejects.toThrow(/Failed to create/);
  });

  it('rejects createComment responses that omit comment payload on success', async () => {
    const issueFn = jest.fn().mockResolvedValue({ id: 'i1', identifier: 'ENG-1', title: 'Bug fix' } as never);
    const createCommentFn = jest.fn().mockResolvedValue({ success: true, comment: undefined } as never);
    getLinearClientMock.mockReturnValue({ issue: issueFn, createComment: createCommentFn } as never);

    await expect(createComment({ issueId: 'ENG-1', body: 'Looks good' })).rejects.toThrow(/did not return a comment/i);
  });

  it('lists comments oldest-first with pagination bounds', async () => {
    const commentsFn = jest.fn().mockResolvedValue({
      nodes: [
        {
          id: 'c1',
          body: 'First',
          issueId: 'i1',
          userId: 'u1',
          createdAt: '2026-04-29T00:00:00.000Z',
          updatedAt: '2026-04-29T00:01:00.000Z',
        },
        {
          id: 'c2',
          body: 'Second',
          parentId: 'c1',
          issue: { id: 'i1' },
          user: { id: 'u2', name: 'Grace' },
          createdAt: '2026-04-29T00:02:00.000Z',
          updatedAt: '2026-04-29T00:03:00.000Z',
        },
      ],
      pageInfo: { hasNextPage: true, hasPreviousPage: false, endCursor: 'cursor-2', startCursor: 'cursor-1' },
    } as never);

    const issueFn = jest
      .fn()
      .mockResolvedValueOnce({ id: 'i1', identifier: 'ENG-1', title: 'Bug fix' } as never)
      .mockResolvedValueOnce({ comments: commentsFn } as never);

    getLinearClientMock.mockReturnValue({ issue: issueFn } as never);

    const result = await listComments({ issueId: 'ENG-1', first: 25, after: 'cursor-1' });

    expect(issueFn).toHaveBeenNthCalledWith(1, 'ENG-1');
    expect(issueFn).toHaveBeenNthCalledWith(2, 'i1');
    expect(commentsFn).toHaveBeenCalledWith({ first: 25, after: 'cursor-1', orderBy: 'createdAt' });
    expect(result.comments).toHaveLength(2);
    expect(result.comments[0]).toMatchObject({
      id: 'c1',
      body: 'First',
      issue: { id: 'i1', identifier: 'ENG-1', title: 'Bug fix' },
    });
    expect(result.comments[1]).toMatchObject({
      id: 'c2',
      body: 'Second',
      parentId: 'c1',
      user: { id: 'u2', name: 'Grace' },
    });
    expect(result.pageInfo).toMatchObject({ hasNextPage: true, endCursor: 'cursor-2' });
  });

  it('rejects invalid pagination input', async () => {
    await expect(listComments({ issueId: 'ENG-1', first: 101 })).rejects.toThrow(/at most 100/i);
    await expect(listComments({ issueId: 'ENG-1', after: '   ' })).rejects.toThrow(/after/i);
  });

  it('throws not found when second issue lookup returns null before loading comments', async () => {
    const issueFn = jest
      .fn()
      .mockResolvedValueOnce({ id: 'i1', identifier: 'ENG-1', title: 'Bug fix' } as never)
      .mockResolvedValueOnce(null as never);

    getLinearClientMock.mockReturnValue({ issue: issueFn } as never);

    await expect(listComments({ issueId: 'ENG-1' })).rejects.toThrow(/Issue not found: i1/i);
  });

  it('tool output follows the content and details contract', async () => {
    const issueFn = jest.fn().mockResolvedValue({ id: 'i1', identifier: 'ENG-1', title: 'Bug fix' } as never);
    const createCommentFn = jest.fn().mockResolvedValue({
      success: true,
      comment: Promise.resolve({ id: 'c1', body: 'Looks good', issueId: 'i1', userId: 'u1' }),
    } as never);
    getLinearClientMock.mockReturnValue({ issue: issueFn, createComment: createCommentFn } as never);

    const response = await linearCreateCommentTool.execute('tool-call-id', { issueId: 'ENG-1', body: 'Looks good' }, new AbortController().signal, undefined, {} as never);
    expect((response.content[0] as { text: string }).text).toMatch(/Added comment to ENG-1/);
    expect(response.details.comment.body).toBe('Looks good');
    expect(response.details.issue.identifier).toBe('ENG-1');

    const commentsFn = jest.fn().mockResolvedValue({
      nodes: [{ id: 'c1', body: 'Looks good', issueId: 'i1' }],
      pageInfo: { hasNextPage: false, hasPreviousPage: false },
    } as never);
    getLinearClientMock.mockReturnValue({
      issue: jest
        .fn()
        .mockResolvedValueOnce({ id: 'i1', identifier: 'ENG-1', title: 'Bug fix' } as never)
        .mockResolvedValueOnce({ comments: commentsFn } as never),
    } as never);

    const listResponse = await linearListCommentsTool.execute('tool-call-id', { issueId: 'ENG-1' }, new AbortController().signal, undefined, {} as never);
    expect((listResponse.content[0] as { text: string }).text).toMatch(/Found 1 comments/);
    expect(listResponse.details.comments).toHaveLength(1);
  });
});
