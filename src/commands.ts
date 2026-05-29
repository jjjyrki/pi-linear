import type { ExtensionAPI } from '@mariozechner/pi-coding-agent';

import { getLinearClient } from './client.js';
import {
  classifyLinearStatusFailure,
  describeLinearStatusFailure,
  formatSafeErrorMessage,
  getLinearApiKeyState,
  withLinearOperation,
} from './linear/errorHandling.js';

export const linearCommandNames = ['linear', 'linear-status', 'linear-tools'] as const;

type LinearToolHelp = {
  name: string;
  requiredInputs: string;
};

const linearToolHelp: LinearToolHelp[] = [
  { name: 'linear_create_issue', requiredInputs: 'teamId, title, optional parentId' },
  { name: 'linear_create_issues', requiredInputs: 'teamId, issues[]' },
  { name: 'linear_create_issue_with_subissues', requiredInputs: 'teamId, parent, subissues[]' },
  { name: 'linear_create_issue_relation', requiredInputs: 'issueId, relatedIssueId, type' },
  { name: 'linear_delete_issue_relation', requiredInputs: 'relationId' },
  { name: 'linear_read_issue', requiredInputs: 'issueId' },
  { name: 'linear_list_issue_relations', requiredInputs: 'issueId' },
  { name: 'linear_list_issues', requiredInputs: '(none)' },
  { name: 'linear_search_issues', requiredInputs: 'query, optional teamId/includeArchived/first' },
  { name: 'linear_sync_task_file', requiredInputs: 'teamId, taskFilePath, optional mode/createSubtasks/linkDependencies' },
  { name: 'linear_create_task_subissues_from_markdown', requiredInputs: 'teamId, taskFilePath, branchPrefix' },
  { name: 'linear_update_issue', requiredInputs: 'issueId + at least one field to update, optional parentId' },
  { name: 'linear_assign_issue', requiredInputs: 'issueId, assigneeId (or null to unassign)' },
  { name: 'linear_create_comment', requiredInputs: 'issueId, body' },
  { name: 'linear_list_comments', requiredInputs: 'issueId' },
  { name: 'linear_viewer', requiredInputs: '(none)' },
  { name: 'linear_list_teams', requiredInputs: '(none)' },
  { name: 'linear_list_users', requiredInputs: 'query optional; first/after optional' },
  { name: 'linear_list_workflow_states', requiredInputs: '(none)' },
  { name: 'linear_list_labels', requiredInputs: 'teamId/query optional; first/after optional' },
  { name: 'linear_list_projects', requiredInputs: 'teamId/query/statusId optional; first/after optional' },
  { name: 'linear_list_cycles', requiredInputs: 'teamId optional; first/after optional' },
];

export function registerLinearCommands(pi: ExtensionAPI): void {
  pi.registerCommand('linear', {
    description: 'Show Linear extension help and examples.',
    handler: async () => {
      pi.sendMessage({
        customType: 'linear-help',
        content: buildLinearHelpMessage(),
        display: true,
      });
    },
  });

  pi.registerCommand('linear-status', {
    description: 'Check whether Linear is configured and reachable.',
    handler: async (_args, ctx) => {
      const apiKeyState = getLinearApiKeyState();
      if (apiKeyState === 'missing') {
        ctx.ui.notify('LINEAR_API_KEY is not set. Set it and reload Pi.', 'warning');
        return;
      }
      if (apiKeyState === 'blank') {
        ctx.ui.notify('LINEAR_API_KEY is set but empty. Set a valid API key and reload Pi.', 'warning');
        return;
      }

      try {
        await withLinearOperation('linear-status', async () => getLinearClient().viewer);
        ctx.ui.notify('LINEAR_API_KEY is set and Linear authentication looks good.', 'info');
      } catch (error) {
        const category = classifyLinearStatusFailure(error);
        ctx.ui.notify(
          `LINEAR_API_KEY is set, but ${describeLinearStatusFailure(category)} (${formatSafeErrorMessage(error, { operation: 'linear-status' })})`,
          'error',
        );
      }
    },
  });

  pi.registerCommand('linear-tools', {
    description: 'List the Linear tools and their required inputs.',
    handler: async () => {
      pi.sendMessage({
        customType: 'linear-tools',
        content: buildLinearToolsMessage(),
        display: true,
      });
    },
  });
}

function buildLinearHelpMessage(): string {
  return [
    'Linear extension',
    `Credentials: ${describeCredentialState(getLinearApiKeyState())}`,
    '',
    'Agent tools: issue CRUD, comments, and discovery (viewer, teams, users, workflow states, labels, projects, cycles).',
    'Discover IDs with list tools before create/update (labels, projects, cycles, states, users).',
    'Try:',
    '- Create ENG issue titled "Fix flaky checkout test"',
    '- List my open Linear issues for team ENG',
    '- Add a comment to ENG-123 with the failure summary',
    '',
    'Issue and comment changes are performed by agent tools, not by this slash command.',
  ].join('\n');
}

function buildLinearToolsMessage(): string {
  return [
    'Linear tools',
    ...linearToolHelp.map((tool) => `- ${tool.name}: ${tool.requiredInputs}`),
  ].join('\n');
}

function describeCredentialState(state: ReturnType<typeof getLinearApiKeyState>): string {
  switch (state) {
    case 'configured':
      return 'configured';
    case 'blank':
      return 'blank';
    default:
      return 'missing';
  }
}
