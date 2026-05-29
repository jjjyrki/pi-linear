import { jest } from '@jest/globals';

const getLinearClientMock = jest.fn();

jest.unstable_mockModule('../src/client.js', () => ({
  getLinearClient: getLinearClientMock,
}));

const { LinearValidationError } = await import('../src/errors.js');
const { listIssueRelations, linearListIssueRelationsTool } = await import('../src/tools/listIssueRelations.js');
const { deleteIssueRelation, linearDeleteIssueRelationTool } = await import('../src/tools/deleteIssueRelation.js');

describe('issue relation management tools', () => {
  beforeEach(() => {
    getLinearClientMock.mockReset();
  });

  it('validates list and delete input before mutation', async () => {
    await expect(listIssueRelations({ issueId: '' })).rejects.toThrow(LinearValidationError);
    await expect(deleteIssueRelation({ relationId: '   ' })).rejects.toThrow(LinearValidationError);
  });

  it('lists outgoing and incoming relations from the requested issue perspective', async () => {
    const issueModel = {
      relations: jest.fn().mockResolvedValue({
        nodes: [
          {
            id: 'r1',
            type: 'blocks',
            issue: { id: 'i1' },
            relatedIssue: { id: 'i2' },
            updatedAt: '2026-05-29T10:00:00.000Z',
          },
          {
            id: 'r2',
            type: 'related',
            issue: { id: 'i1' },
            relatedIssue: { id: 'i3' },
            createdAt: '2026-05-29T09:00:00.000Z',
          },
        ],
      } as never),
      inverseRelations: jest.fn().mockResolvedValue({
        nodes: [
          {
            id: 'r3',
            type: 'blocks',
            issue: { id: 'i4' },
            relatedIssue: { id: 'i1' },
            updatedAt: '2026-05-29T11:00:00.000Z',
          },
        ],
      } as never),
    };

    const issueFn = jest.fn(async (reference: string) => {
      switch (reference) {
        case 'ENG-1':
        case 'i1':
          return { id: 'i1', identifier: 'ENG-1', title: 'Primary issue' } as never;
        case 'i2':
          return { id: 'i2', identifier: 'ENG-2', title: 'Blocked issue' } as never;
        case 'i3':
          return { id: 'i3', identifier: 'ENG-3', title: 'Related issue' } as never;
        case 'i4':
          return { id: 'i4', identifier: 'ENG-4', title: 'Blocking issue' } as never;
        default:
          return undefined as never;
      }
    });

    getLinearClientMock.mockReturnValue({ issue: issueFn } as never);
    issueFn.mockImplementation(async (reference: string) => {
      if (reference === 'ENG-1') {
        return { id: 'i1', identifier: 'ENG-1', title: 'Primary issue', relations: issueModel.relations, inverseRelations: issueModel.inverseRelations } as never;
      }
      if (reference === 'i1') {
        return { id: 'i1', identifier: 'ENG-1', title: 'Primary issue', relations: issueModel.relations, inverseRelations: issueModel.inverseRelations } as never;
      }
      if (reference === 'i2') {
        return { id: 'i2', identifier: 'ENG-2', title: 'Blocked issue' } as never;
      }
      if (reference === 'i3') {
        return { id: 'i3', identifier: 'ENG-3', title: 'Related issue' } as never;
      }
      if (reference === 'i4') {
        return { id: 'i4', identifier: 'ENG-4', title: 'Blocking issue' } as never;
      }
      return undefined as never;
    });

    const result = await listIssueRelations({ issueId: 'ENG-1' });

    expect(issueFn).toHaveBeenCalledWith('ENG-1');
    expect(issueModel.relations).toHaveBeenCalled();
    expect(issueModel.inverseRelations).toHaveBeenCalled();
    expect(result).toEqual({
      issue: { id: 'i1', identifier: 'ENG-1', title: 'Primary issue' },
      nodes: [
        {
          id: 'r3',
          type: 'blocked_by',
          counterpartIssue: { id: 'i4', identifier: 'ENG-4', title: 'Blocking issue' },
          updatedAt: '2026-05-29T11:00:00.000Z',
        },
        {
          id: 'r1',
          type: 'blocks',
          counterpartIssue: { id: 'i2', identifier: 'ENG-2', title: 'Blocked issue' },
          updatedAt: '2026-05-29T10:00:00.000Z',
        },
        {
          id: 'r2',
          type: 'related',
          counterpartIssue: { id: 'i3', identifier: 'ENG-3', title: 'Related issue' },
          createdAt: '2026-05-29T09:00:00.000Z',
        },
      ],
    });
  });

  it('renders relation list output with relation ids', async () => {
    const issueModel = {
      relations: jest.fn().mockResolvedValue({
        nodes: [{ id: 'r1', type: 'blocks', issue: { id: 'i1' }, relatedIssue: { id: 'i2' } }],
      } as never),
      inverseRelations: jest.fn().mockResolvedValue({ nodes: [] } as never),
    };
    const issueFn = jest.fn(async (reference: string) => {
      if (reference === 'ENG-1' || reference === 'i1') {
        return { id: 'i1', identifier: 'ENG-1', title: 'Primary issue', relations: issueModel.relations, inverseRelations: issueModel.inverseRelations } as never;
      }
      if (reference === 'i2') {
        return { id: 'i2', identifier: 'ENG-2', title: 'Blocked issue' } as never;
      }
      return undefined as never;
    });

    getLinearClientMock.mockReturnValue({ issue: issueFn } as never);

    const response = await linearListIssueRelationsTool.execute('tool-call-id', { issueId: 'ENG-1' }, new AbortController().signal, undefined, {} as never);
    const text = (response.content[0] as { text: string }).text;

    expect(text).toContain('Found 1 relations for ENG-1');
    expect(text).toContain('blocks ENG-2');
    expect(text).toContain('id: r1');
  });

  it('deletes an issue relation by relation id', async () => {
    const deleteIssueRelationFn = jest.fn().mockResolvedValue({ success: true, entityId: 'r1' } as never);
    getLinearClientMock.mockReturnValue({ deleteIssueRelation: deleteIssueRelationFn } as never);

    const result = await deleteIssueRelation({ relationId: 'r1' });

    expect(deleteIssueRelationFn).toHaveBeenCalledWith('r1');
    expect(result).toEqual({ relationId: 'r1' });
  });

  it('surfaces delete failures and visible delete output', async () => {
    const deleteIssueRelationFn = jest.fn()
      .mockResolvedValueOnce({ success: false } as never)
      .mockResolvedValueOnce({ success: true, entityId: 'r2' } as never);
    getLinearClientMock.mockReturnValue({ deleteIssueRelation: deleteIssueRelationFn } as never);

    await expect(deleteIssueRelation({ relationId: 'r1' })).rejects.toThrow(/r1/i);

    const response = await linearDeleteIssueRelationTool.execute('tool-call-id', { relationId: 'r2' }, new AbortController().signal, undefined, {} as never);
    const text = (response.content[0] as { text: string }).text;

    expect(text).toContain('Deleted issue relation r2');
    expect(response.details).toEqual({ relationId: 'r2' });
  });
});
