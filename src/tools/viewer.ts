import { defineTool } from '@mariozechner/pi-coding-agent';
import { Type } from '@mariozechner/pi-ai';

import { getLinearClient } from '../client.js';
import { normalizeViewer, type NormalizedUser } from '../linear/shared.js';

export async function viewLinearUser(): Promise<{ viewer: NormalizedUser }> {
  const viewer = normalizeViewer(await getLinearClient().viewer);
  return { viewer };
}

export const linearViewerTool = defineTool({
  name: 'linear_viewer',
  label: 'Viewer',
  description: 'Read the authenticated Linear user.',
  parameters: Type.Object({}),
  async execute(_toolCallId) {
    const result = await viewLinearUser();
    const label = result.viewer.displayName ?? result.viewer.name ?? result.viewer.id;

    return {
      content: [{ type: 'text', text: `Signed in as ${label} (id: ${result.viewer.id})` }],
      details: result,
    };
  },
});
