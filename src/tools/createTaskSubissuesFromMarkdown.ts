import { defineTool } from '@mariozechner/pi-coding-agent';
import { Type } from '@mariozechner/pi-ai';

import { getLinearClient } from '../client.js';
import { LinearValidationError } from '../errors.js';
import { normalizeIssueSummary, type NormalizedIssueSummary } from '../linear/shared.js';
import {
  buildSubTaskIssueDescription,
  buildSubTaskIssueTitle,
  parseTaskMarkdownFile,
  type ParsedTaskFile,
  type ParsedTaskSubTask,
} from '../taskFiles.js';
import { createIssues } from './createIssues.js';

export type CreatedTaskSubissue = {
  key: string;
  preferredBranch: string;
  baseBranchGuidance: string;
  issue: NormalizedIssueSummary;
};

export type CreateTaskSubissuesFromMarkdownResult = {
  subissues: CreatedTaskSubissue[];
};

const createTaskSubissuesFromMarkdownSchema = Type.Object({
  teamId: Type.String(),
  taskFilePath: Type.String(),
  branchPrefix: Type.String(),
  includeBranchGuidance: Type.Optional(Type.Boolean()),
});

export async function createTaskSubissuesFromMarkdown(
  input: Record<string, unknown>,
): Promise<CreateTaskSubissuesFromMarkdownResult> {
  const teamId = requireNonEmptyString(input.teamId, 'teamId');
  const taskFilePath = requireNonEmptyString(input.taskFilePath, 'taskFilePath');
  const branchPrefix = validateBranchPrefix(input.branchPrefix);
  const includeBranchGuidance = optionalBoolean(input.includeBranchGuidance, 'includeBranchGuidance') ?? true;
  const task = await parseTaskMarkdownFile(taskFilePath);

  if (task.subTasks.length === 0) {
    throw new LinearValidationError('task file must include at least one implementation sub-task.');
  }

  const parentIssue = await findParentIssue(teamId, task.id);
  if (!parentIssue) {
    throw new LinearValidationError(`Parent Linear issue for ${task.id} was not found. Run linear_sync_task_file first.`);
  }

  const planned = task.subTasks.map((subTask) => planSubissue(task, subTask, branchPrefix, includeBranchGuidance));
  const created = await createIssues({
    teamId,
    issues: planned.map((subissue) => ({
      title: subissue.title,
      description: subissue.description,
      parentId: parentIssue.id,
    })),
  });

  return {
    subissues: planned.map((subissue, index) => ({
      key: subissue.key,
      preferredBranch: subissue.preferredBranch,
      baseBranchGuidance: subissue.baseBranchGuidance,
      issue: created.issues[index],
    })),
  };
}

export const linearCreateTaskSubissuesFromMarkdownTool = defineTool({
  name: 'linear_create_task_subissues_from_markdown',
  label: 'Create Task Sub-Issues From Markdown',
  description: 'Create Linear sub-issues from a markdown task file with optional branch guidance.',
  promptSnippet: 'Create task-file sub-issues',
  promptGuidelines: ['Use linear_create_task_subissues_from_markdown only after confirming the parent issue.'],
  parameters: createTaskSubissuesFromMarkdownSchema,
  async execute(_toolCallId, input) {
    const result = await createTaskSubissuesFromMarkdown(input as Record<string, unknown>);
    const lines = result.subissues.map((subissue) => (
      `- ${subissue.issue.identifier}: ${subissue.issue.title} -> ${subissue.preferredBranch} (id: ${subissue.issue.id})`
    ));
    return {
      content: [{ type: 'text', text: [`Created ${result.subissues.length} task sub-issues:`, ...lines].join('\n') }],
      details: result,
    };
  },
});

export function buildPreferredBranchName(task: ParsedTaskFile, subTask: ParsedTaskSubTask, branchPrefix: string): string {
  const keySuffix = subTask.key.toLowerCase().startsWith(`${task.id.toLowerCase()}.`)
    ? subTask.key.slice(task.id.length + 1).replace(/\./g, '-')
    : slugify(subTask.key);
  return `${branchPrefix}-${keySuffix}-${slugify(subTask.title)}`.replace(/-+/g, '-');
}

export function buildBaseBranchGuidance(subTask: ParsedTaskSubTask): string {
  if (subTask.blockedBy.length === 0) {
    return 'Base branch: latest `main`.';
  }
  return `Base branch: latest \`main\` after ${formatDependencyList(subTask.blockedBy)} ${subTask.blockedBy.length === 1 ? 'is' : 'are'} merged.`;
}

function planSubissue(
  task: ParsedTaskFile,
  subTask: ParsedTaskSubTask,
  branchPrefix: string,
  includeBranchGuidance: boolean,
): { key: string; title: string; description: string; preferredBranch: string; baseBranchGuidance: string } {
  const preferredBranch = buildPreferredBranchName(task, subTask, branchPrefix);
  const baseBranchGuidance = buildBaseBranchGuidance(subTask);
  const description = includeBranchGuidance
    ? appendBranchGuidance(buildSubTaskIssueDescription(task, subTask), preferredBranch, baseBranchGuidance)
    : buildSubTaskIssueDescription(task, subTask);

  return {
    key: subTask.key,
    title: buildSubTaskIssueTitle(subTask),
    description,
    preferredBranch,
    baseBranchGuidance,
  };
}

function appendBranchGuidance(description: string, preferredBranch: string, baseBranchGuidance: string): string {
  return [
    description,
    '',
    'Branch order / PR guidance:',
    `- Preferred branch: \`${preferredBranch}\``,
    `- ${baseBranchGuidance}`,
    '- Stack only if absolutely necessary.',
  ].join('\n');
}

async function findParentIssue(teamId: string, taskId: string): Promise<NormalizedIssueSummary | undefined> {
  const result = await getLinearClient().searchIssues(taskId, {
    first: 25,
    includeArchived: false,
    teamId,
  } as never);
  const taskIdLower = taskId.toLowerCase();
  return (result.nodes ?? [])
    .map((issue) => normalizeIssueSummary(issue))
    .find((issue) => issue.title.toLowerCase().includes(taskIdLower));
}

function validateBranchPrefix(value: unknown): string {
  const branchPrefix = requireNonEmptyString(value, 'branchPrefix');
  if (
    branchPrefix.includes('..')
    || branchPrefix.startsWith('/')
    || branchPrefix.endsWith('/')
    || !/^[A-Za-z0-9._/-]+$/.test(branchPrefix)
  ) {
    throw new LinearValidationError('branchPrefix must be safe for git branch names.');
  }
  return branchPrefix.toLowerCase();
}

function requireNonEmptyString(value: unknown, fieldName: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new LinearValidationError(`${fieldName} must be a non-empty string.`);
  }
  return value.trim();
}

function optionalBoolean(value: unknown, fieldName: string): boolean | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'boolean') {
    throw new LinearValidationError(`${fieldName} must be a boolean when provided.`);
  }
  return value;
}

function slugify(value: string): string {
  const slug = value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'task';
}

function formatDependencyList(dependencies: string[]): string {
  if (dependencies.length === 1) {
    return dependencies[0];
  }
  if (dependencies.length === 2) {
    return `${dependencies[0]} and ${dependencies[1]}`;
  }
  return `${dependencies.slice(0, -1).join(', ')}, and ${dependencies[dependencies.length - 1]}`;
}
