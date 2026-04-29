import { defineTool } from '@mariozechner/pi-coding-agent';
import { Type } from '@mariozechner/pi-ai';

import { getLinearClient } from '../client.js';
import { normalizeDiscoveryWorkflowState, type NormalizedWorkflowState } from '../linear/shared.js';

const listWorkflowStatesSchema = Type.Object({});

export async function listLinearWorkflowStates(): Promise<{ workflowStates: NormalizedWorkflowState[]; truncated: boolean }> {
  const client = getLinearClient();
  const workflowStates: NormalizedWorkflowState[] = [];
  let after: string | undefined;

  for (let page = 0; page < 10; page += 1) {
    const connection = await client.workflowStates({ first: 100, after } as never);
    workflowStates.push(...(connection.nodes ?? []).map(normalizeDiscoveryWorkflowState));

    if (!connection.pageInfo?.hasNextPage) {
      return { workflowStates, truncated: false };
    }

    after = connection.pageInfo.endCursor ?? undefined;
    if (!after) {
      return { workflowStates, truncated: false };
    }
  }

  return { workflowStates, truncated: true };
}

export const linearListWorkflowStatesTool = defineTool({
  name: 'linear_list_workflow_states',
  label: 'List Workflow States',
  description: 'List Linear workflow states so agents can discover state IDs.',
  parameters: listWorkflowStatesSchema,
  async execute() {
    const result = await listLinearWorkflowStates();
    const text = result.truncated
      ? `Found ${result.workflowStates.length} workflow states (truncated at 1000)`
      : `Found ${result.workflowStates.length} workflow states`;

    return {
      content: [{ type: 'text', text }],
      details: result,
    };
  },
});
