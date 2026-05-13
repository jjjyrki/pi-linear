import { jest } from '@jest/globals';

const getLinearClientMock = jest.fn();

jest.unstable_mockModule('../src/client.js', () => ({
  getLinearClient: getLinearClientMock,
}));

const { registerLinearCommands } = await import('../src/commands.js');

describe('linear slash commands', () => {
  const originalApiKey = process.env.LINEAR_API_KEY;

  beforeEach(() => {
    getLinearClientMock.mockReset();
    delete process.env.LINEAR_API_KEY;
  });

  afterEach(() => {
    if (originalApiKey === undefined) {
      delete process.env.LINEAR_API_KEY;
    } else {
      process.env.LINEAR_API_KEY = originalApiKey;
    }
  });

  function registerCommands() {
    const handlers: Record<string, (args: string, ctx: { ui: { notify: (message: string, level: string) => void } }) => Promise<void>> = {};
    const sendMessage = jest.fn();

    registerLinearCommands({
      registerCommand: (name: string, options: { handler: (args: string, ctx: { ui: { notify: (message: string, level: string) => void } }) => Promise<void> }) => {
        handlers[name] = options.handler;
      },
      sendMessage,
    } as never);

    return { handlers, sendMessage };
  }

  it('shows help and tool metadata from /linear and /linear-tools', async () => {
    process.env.LINEAR_API_KEY = 'test-token';
    const { handlers, sendMessage } = registerCommands();

    await handlers.linear('', { ui: { notify: jest.fn() } } as never);
    expect(sendMessage).toHaveBeenCalledWith(expect.objectContaining({
      customType: 'linear-help',
      display: true,
      content: expect.stringContaining('Credentials: configured'),
    }));
    expect((sendMessage.mock.calls[0][0] as { content: string }).content).toContain('Issue and comment changes are performed by agent tools');

    await handlers['linear-tools']('', { ui: { notify: jest.fn() } } as never);
    expect(sendMessage).toHaveBeenLastCalledWith(expect.objectContaining({
      customType: 'linear-tools',
      display: true,
      content: expect.stringContaining('linear_create_issue: teamId, title, optional parentId'),
    }));
    expect((sendMessage.mock.calls[1][0] as { content: string }).content).toContain('linear_create_issues: teamId, issues[]');
    expect((sendMessage.mock.calls[1][0] as { content: string }).content).toContain('linear_create_issue_with_subissues: teamId, parent, subissues[]');
    expect((sendMessage.mock.calls[1][0] as { content: string }).content).toContain('linear_create_issue_relation: issueId, relatedIssueId, type');
    expect((sendMessage.mock.calls[1][0] as { content: string }).content).toContain('linear_search_issues: query, optional teamId/includeArchived/first');
    expect((sendMessage.mock.calls[1][0] as { content: string }).content).toContain('linear_sync_task_file: teamId, taskFilePath, optional mode/createSubtasks/linkDependencies');
    expect((sendMessage.mock.calls[1][0] as { content: string }).content).toContain('linear_create_task_subissues_from_markdown: teamId, taskFilePath, branchPrefix');
    expect((sendMessage.mock.calls[1][0] as { content: string }).content).toContain('linear_list_workflow_states: (none)');
  });

  it('validates /linear-status without leaking secrets', async () => {
    const { handlers } = registerCommands();
    const notify = jest.fn();

    await handlers['linear-status']('', { ui: { notify } } as never);
    expect(notify).toHaveBeenCalledWith('LINEAR_API_KEY is not set. Set it and reload Pi.', 'warning');

    process.env.LINEAR_API_KEY = 'test-token';
    getLinearClientMock.mockReturnValue({ viewer: Promise.resolve({ id: 'u1', name: 'Ada' }) } as never);

    await handlers['linear-status']('', { ui: { notify } } as never);
    expect(notify).toHaveBeenLastCalledWith('LINEAR_API_KEY is set and Linear authentication looks good.', 'info');
  });
});
