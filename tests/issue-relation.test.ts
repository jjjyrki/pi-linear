import { jest } from '@jest/globals';

const getLinearClientMock = jest.fn();

jest.unstable_mockModule('../src/client.js', () => ({
  getLinearClient: getLinearClientMock,
}));

const { LinearValidationError } = await import('../src/errors.js');
const { createIssueRelation, buildIssueRelationPayload, linearCreateIssueRelationTool } = await import('../src/tools/createIssueRelation.js');

describe('issue relation tool', () => {
  beforeEach(() => {
    getLinearClientMock.mockReset();
  });

  it('validates relation input before mutation', async () => {
    await expect(createIssueRelation({ issueId: '', relatedIssueId: 'ENG-2', type: 'blocks' })).rejects.toThrow(LinearValidationError);
    await expect(createIssueRelation({ issueId: 'ENG-1', relatedIssueId: 'ENG-2', type: 'duplicate' })).rejects.toThrow(/blocks, blocked_by, or related/i);
  });

  it('maps public relation types to SDK payload direction', () => {
    expect(buildIssueRelationPayload('i1', 'i2', 'blocks')).toEqual({ issueId: 'i1', relatedIssueId: 'i2', type: 'blocks' });
    expect(buildIssueRelationPayload('i1', 'i2', 'blocked_by')).toEqual({ issueId: 'i2', relatedIssueId: 'i1', type: 'blocks' });
    expect(buildIssueRelationPayload('i1', 'i2', 'related')).toEqual({ issueId: 'i1', relatedIssueId: 'i2', type: 'related' });
  });

  it('resolves both issue references and creates a blocking relation', async () => {
    const issueFn = jest.fn()
      .mockResolvedValueOnce({ id: 'i1', identifier: 'ENG-1', title: 'Issue one' } as never)
      .mockResolvedValueOnce({ id: 'i2', identifier: 'ENG-2', title: 'Issue two' } as never);
    const createIssueRelationFn = jest.fn().mockResolvedValue({
      success: true,
      issueRelation: Promise.resolve({ id: 'r1', type: 'blocks' }),
    } as never);

    getLinearClientMock.mockReturnValue({ issue: issueFn, createIssueRelation: createIssueRelationFn } as never);

    const result = await createIssueRelation({ issueId: 'ENG-1', relatedIssueId: 'ENG-2', type: 'blocks' });

    expect(issueFn).toHaveBeenNthCalledWith(1, 'ENG-1');
    expect(issueFn).toHaveBeenNthCalledWith(2, 'ENG-2');
    expect(createIssueRelationFn).toHaveBeenCalledWith({ issueId: 'i1', relatedIssueId: 'i2', type: 'blocks' });
    expect(result).toEqual({
      relation: { id: 'r1', type: 'blocks' },
      issue: { id: 'i1', identifier: 'ENG-1', title: 'Issue one' },
      relatedIssue: { id: 'i2', identifier: 'ENG-2', title: 'Issue two' },
    });
  });

  it('creates blocked_by and related relations', async () => {
    const issueFn = jest.fn()
      .mockResolvedValue({ id: 'i1', identifier: 'ENG-1', title: 'Issue one' } as never)
      .mockResolvedValueOnce({ id: 'i1', identifier: 'ENG-1', title: 'Issue one' } as never)
      .mockResolvedValueOnce({ id: 'i2', identifier: 'ENG-2', title: 'Issue two' } as never);
    const createIssueRelationFn = jest.fn().mockResolvedValue({
      success: true,
      issueRelationId: 'r1',
    } as never);

    getLinearClientMock.mockReturnValue({ issue: issueFn, createIssueRelation: createIssueRelationFn } as never);

    await createIssueRelation({ issueId: 'ENG-1', relatedIssueId: 'ENG-2', type: 'blocked_by' });
    issueFn.mockClear();
    issueFn.mockResolvedValueOnce({ id: 'i1', identifier: 'ENG-1', title: 'Issue one' } as never)
      .mockResolvedValueOnce({ id: 'i2', identifier: 'ENG-2', title: 'Issue two' } as never);
    await createIssueRelation({ issueId: 'ENG-1', relatedIssueId: 'ENG-2', type: 'related' });

    expect(createIssueRelationFn).toHaveBeenNthCalledWith(1, { issueId: 'i2', relatedIssueId: 'i1', type: 'blocks' });
    expect(createIssueRelationFn).toHaveBeenNthCalledWith(2, { issueId: 'i1', relatedIssueId: 'i2', type: 'related' });
  });

  it('surfaces Linear API failures with issue context', async () => {
    const issueFn = jest.fn()
      .mockResolvedValueOnce({ id: 'i1', identifier: 'ENG-1', title: 'Issue one' } as never)
      .mockResolvedValueOnce({ id: 'i2', identifier: 'ENG-2', title: 'Issue two' } as never);
    const createIssueRelationFn = jest.fn().mockResolvedValue({ success: false } as never);

    getLinearClientMock.mockReturnValue({ issue: issueFn, createIssueRelation: createIssueRelationFn } as never);

    await expect(createIssueRelation({ issueId: 'ENG-1', relatedIssueId: 'ENG-2', type: 'related' })).rejects.toThrow(/ENG-1 and ENG-2/i);
  });

  it('visible output includes relation type and IDs', async () => {
    const issueFn = jest.fn()
      .mockResolvedValueOnce({ id: 'i1', identifier: 'ENG-1', title: 'Issue one' } as never)
      .mockResolvedValueOnce({ id: 'i2', identifier: 'ENG-2', title: 'Issue two' } as never);
    const createIssueRelationFn = jest.fn().mockResolvedValue({
      success: true,
      issueRelation: Promise.resolve({ id: 'r1', type: 'blocks' }),
    } as never);

    getLinearClientMock.mockReturnValue({ issue: issueFn, createIssueRelation: createIssueRelationFn } as never);

    const response = await linearCreateIssueRelationTool.execute('tool-call-id', {
      issueId: 'ENG-1',
      relatedIssueId: 'ENG-2',
      type: 'blocked_by',
    }, new AbortController().signal, undefined, {} as never);
    const text = (response.content[0] as { text: string }).text;

    expect(text).toContain('ENG-1 is blocked by ENG-2');
    expect(text).toContain('id: r1');
    expect(response.details.relation).toEqual({ id: 'r1', type: 'blocked_by' });
  });
});
