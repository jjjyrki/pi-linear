import { defineTool } from '@mariozechner/pi-coding-agent';
import { Type } from '@mariozechner/pi-ai';

import { getLinearClient } from '../client.js';
import { normalizeDiscoveryWorkflowState, type NormalizedWorkflowState } from '../linear/shared.js';

const listWorkflowStatesSchema = Type.Object({});

export async function listLinearWorkflowStates(): Promise<{ workflowStates: NormalizedWorkflowState[] }> {
  const client = getLinearClient();
  const workflowStates: NormalizedWorkflowState[] = [];
  let after: string | undefined;

  for (let page = 0; page < 10; page += 1) {
    const connection = await client.workflowStates({ first: 100, after } as never);
    workflowStates.push(...(connection.nodes ?? []).map(normalizeDiscoveryWorkflowState));

    if (!connection.pageInfo?.hasNextPage) {
      return { workflowStates };
    }

    after = connection.pageInfo.endCursor ?? undefined;
    if (!after) {
      break;
    }
  }

  return { workflowStates };
}

export const linearListWorkflowStatesTool = defineTool({
  name: 'linear_list_workflow_states',
  label: 'List Workflow States',
  description: 'List Linear workflow states so agents can discover state IDs.',
  parameters: listWorkflowStatesSchema,
  async execute() {
    const result = await listLinearWorkflowStates();
    return {
      content: [{ type: 'text', text: `Found ${result.workflowStates.length} workflow states` }],
      details: result,
    };
  },
});
