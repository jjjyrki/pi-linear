import { defineTool } from '@mariozechner/pi-coding-agent';
import { Type } from '@mariozechner/pi-ai';

import { getLinearClient } from '../client.js';
import { normalizeDiscoveryWorkflowState, type NormalizedWorkflowState } from '../linear/shared.js';
import { formatWorkflowStateLine } from './format.js';

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
  description: 'List up to 1000 Linear workflow states so agents can discover state IDs.',
  promptSnippet: 'List workflow states',
  promptGuidelines: ['Use linear_list_workflow_states when stateId is unknown.'],
  parameters: listWorkflowStatesSchema,
  async execute() {
    const result = await listLinearWorkflowStates();
    const heading = result.truncated
      ? `Found ${result.workflowStates.length} workflow states (truncated at 1000):`
      : `Found ${result.workflowStates.length} workflow states:`;
    const stateLines = result.workflowStates.map(formatWorkflowStateLine);
    const text = stateLines.length > 0 ? [heading, ...stateLines].join('\n') : heading.slice(0, -1);

    return {
      content: [{ type: 'text', text }],
      details: result,
    };
  },
});
