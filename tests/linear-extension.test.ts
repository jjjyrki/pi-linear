import linearExtension from '../src/index.js';
import { linearCommandNames } from '../src/commands.js';
import { linearToolDefinitions } from '../src/tools/index.js';

describe('linear extension scaffold', () => {
  it('registers all planned tools and commands', () => {
    const toolNames: string[] = [];
    const commandNames: string[] = [];

    linearExtension({
      registerTool: (tool: { name: string }) => {
        toolNames.push(tool.name);
      },
      registerCommand: (name: string) => {
        commandNames.push(name);
      },
    } as never);

    expect(toolNames).toEqual(linearToolDefinitions.map((tool) => tool.name));
    expect(commandNames).toEqual([...linearCommandNames]);
  });

  it('still includes placeholder handlers for not-yet-implemented tools', async () => {
    const placeholderTool = linearToolDefinitions.find((tool) => tool.name === 'linear_create_comment');
    expect(placeholderTool).toBeDefined();

    await expect(
      placeholderTool!.execute(
        'tool-call-id',
        {},
        new AbortController().signal,
        undefined,
        {} as never,
      ),
    ).rejects.toThrow(/not implemented/i);
  });

  it('placeholder command handlers fail clearly', async () => {
    const registeredCommands: Array<{ name: string; handler: (args: string) => Promise<void> }> = [];

    linearExtension({
      registerTool: () => undefined,
      registerCommand: (name: string, options: { handler: (args: string) => Promise<void> }) => {
        registeredCommands.push({ name, handler: options.handler });
      },
    } as never);

    await expect(registeredCommands[0].handler('')).rejects.toThrow(/not implemented/i);
  });
});
