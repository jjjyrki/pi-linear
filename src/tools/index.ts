import type { ExtensionAPI } from '@mariozechner/pi-coding-agent';

import { linearAssignIssueTool } from './assignIssue.js';
import { linearCreateCommentTool } from './createComment.js';
import { linearCreateIssueTool } from './createIssue.js';
import { linearCreateIssuesTool } from './createIssues.js';
import { linearCreateIssueRelationTool } from './createIssueRelation.js';
import { linearCreateIssueWithSubissuesTool } from './createIssueWithSubissues.js';
import { linearListCommentsTool } from './listComments.js';
import { linearListIssuesTool } from './listIssues.js';
import { linearListTeamsTool } from './listTeams.js';
import { linearListUsersTool } from './listUsers.js';
import { linearListWorkflowStatesTool } from './listWorkflowStates.js';
import { linearReadIssueTool } from './readIssue.js';
import { linearSearchIssuesTool } from './searchIssues.js';
import { linearSyncTaskFileTool } from './syncTaskFile.js';
import { linearUpdateIssueTool } from './updateIssue.js';
import { linearViewerTool } from './viewer.js';

export const linearToolDefinitions = [
  linearCreateIssueTool,
  linearCreateIssuesTool,
  linearCreateIssueWithSubissuesTool,
  linearCreateIssueRelationTool,
  linearReadIssueTool,
  linearListIssuesTool,
  linearSearchIssuesTool,
  linearSyncTaskFileTool,
  linearUpdateIssueTool,
  linearAssignIssueTool,
  linearCreateCommentTool,
  linearListCommentsTool,
  linearViewerTool,
  linearListTeamsTool,
  linearListUsersTool,
  linearListWorkflowStatesTool,
] as const;

export function registerLinearTools(pi: ExtensionAPI): void {
  for (const tool of linearToolDefinitions) {
    pi.registerTool(tool);
  }
}
