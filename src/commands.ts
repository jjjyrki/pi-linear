import type { ExtensionAPI } from '@mariozechner/pi-coding-agent';

import { getLinearClient } from './client.js';

export const linearCommandNames = ['linear', 'linear-status', 'linear-tools'] as const;

type LinearToolHelp = {
  name: string;
  requiredInputs: string;
};

const linearToolHelp: LinearToolHelp[] = [
  { name: 'linear_create_issue', requiredInputs: 'teamId, title, optional parentId' },
  { name: 'linear_create_issues', requiredInputs: 'teamId, issues[]' },
  { name: 'linear_read_issue', requiredInputs: 'issueId' },
  { name: 'linear_list_issues', requiredInputs: '(none)' },
  { name: 'linear_search_issues', requiredInputs: 'query, optional teamId/includeArchived/first' },
  { name: 'linear_update_issue', requiredInputs: 'issueId + at least one field to update, optional parentId' },
  { name: 'linear_assign_issue', requiredInputs: 'issueId, assigneeId (or null to unassign)' },
  { name: 'linear_create_comment', requiredInputs: 'issueId, body' },
  { name: 'linear_list_comments', requiredInputs: 'issueId' },
  { name: 'linear_viewer', requiredInputs: '(none)' },
  { name: 'linear_list_teams', requiredInputs: '(none)' },
  { name: 'linear_list_users', requiredInputs: 'query optional; first/after optional' },
  { name: 'linear_list_workflow_states', requiredInputs: '(none)' },
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
      if (!isLinearApiKeyConfigured()) {
        ctx.ui.notify('LINEAR_API_KEY is not set. Set it and reload Pi.', 'warning');
        return;
      }

      try {
        await getLinearClient().viewer;
        ctx.ui.notify('LINEAR_API_KEY is set and Linear authentication looks good.', 'info');
      } catch (error) {
        ctx.ui.notify(`LINEAR_API_KEY is set, but Linear authentication check failed: ${getErrorMessage(error)}`, 'error');
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
    `Credentials: ${isLinearApiKeyConfigured() ? 'configured' : 'missing'}`,
    '',
    'Agent tools: issue CRUD, comments, and discovery (viewer, teams, users, workflow states).',
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

function isLinearApiKeyConfigured(): boolean {
  return Boolean(process.env.LINEAR_API_KEY?.trim());
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }
  return 'unknown error';
}
