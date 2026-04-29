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

  it('includes implemented comment tools', () => {
    expect(linearToolDefinitions.map((tool) => tool.name)).toEqual(expect.arrayContaining([
      'linear_create_comment',
      'linear_list_comments',
    ]));
  });

});
