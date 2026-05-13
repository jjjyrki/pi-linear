import { defineTool } from "@mariozechner/pi-coding-agent";
import { Type } from "@mariozechner/pi-ai";

import { getLinearClient } from "../client.js";
import { LinearValidationError } from "../errors.js";
import {
  buildParentIssueDescription,
  buildParentIssueTitle,
  buildSubTaskIssueDescription,
  buildSubTaskIssueTitle,
  parseTaskMarkdownFile,
  type ParsedTaskFile,
  type ParsedTaskSubTask,
} from "../taskFiles.js";
import {
  normalizeIssueSummary,
  normalizePageInfo,
  type NormalizedIssueSummary,
} from "../linear/shared.js";
import { updateIssue } from "./updateIssue.js";
import { createIssue } from "./createIssue.js";
import { createIssueRelation } from "./createIssueRelation.js";
import { formatIssueSummary } from "./format.js";

const syncModes = ["create_missing", "update_existing", "dry_run"] as const;
type SyncMode = (typeof syncModes)[number];
type SyncAction =
  | "created"
  | "updated"
  | "unchanged"
  | "would_create"
  | "would_update";

export type SyncTaskFileResult = {
  parent: SyncIssueResult;
  subissues: SyncSubissueResult[];
  relations?: SyncRelationResult[];
};

export type SyncIssueResult = {
  action: SyncAction;
  issue?: NormalizedIssueSummary;
};

export type SyncSubissueResult = SyncIssueResult & {
  key: string;
};

export type SyncRelationResult = {
  action: "created" | "unchanged" | "would_create";
  issueKey: string;
  blockedBy: string[];
};

const syncTaskFileSchema = Type.Object({
  teamId: Type.String(),
  taskFilePath: Type.String(),
  mode: Type.Optional(Type.Union(syncModes.map((mode) => Type.Literal(mode)))),
  createSubtasks: Type.Optional(Type.Boolean()),
  linkDependencies: Type.Optional(Type.Boolean()),
});

export async function syncTaskFile(
  input: Record<string, unknown>,
): Promise<SyncTaskFileResult> {
  const teamId = requireNonEmptyString(input.teamId, "teamId");
  const taskFilePath = requireNonEmptyString(
    input.taskFilePath,
    "taskFilePath",
  );
  const mode = validateMode(input.mode);
  const createSubtasks =
    optionalBoolean(input.createSubtasks, "createSubtasks") ?? true;
  const linkDependencies =
    optionalBoolean(input.linkDependencies, "linkDependencies") ?? false;
  const task = await parseTaskMarkdownFile(taskFilePath);

  const parent = await syncParentIssue(task, teamId, mode);
  const subissues = createSubtasks
    ? await syncSubissues(task, teamId, mode, parent.issue)
    : [];
  const result: SyncTaskFileResult = { parent, subissues };

  if (linkDependencies) {
    result.relations = await syncDependencyRelations(
      task,
      mode,
      parent,
      subissues,
    );
  }

  return result;
}

export const linearSyncTaskFileTool = defineTool({
  name: "linear_sync_task_file",
  label: "Sync Task File",
  description: "Idempotently sync a local markdown task file to Linear issues.",
  parameters: syncTaskFileSchema,
  async execute(_toolCallId, input) {
    const result = await syncTaskFile(input as Record<string, unknown>);
    return {
      content: [{ type: "text", text: formatSyncResult(result) }],
      details: result,
    };
  },
});

async function syncParentIssue(
  task: ParsedTaskFile,
  teamId: string,
  mode: SyncMode,
): Promise<SyncIssueResult> {
  const existing = await findIssueByTaskKey(teamId, task.id);
  const title = buildParentIssueTitle(task);
  const description = buildParentIssueDescription(task);

  if (!existing) {
    if (mode === "dry_run") {
      return { action: "would_create" };
    }
    return {
      action: "created",
      issue: await createIssue({ teamId, title, description }),
    };
  }

  if (mode === "dry_run") {
    return { action: "would_update", issue: existing };
  }
  if (mode === "update_existing") {
    return {
      action: "updated",
      issue: await updateIssue({ issueId: existing.id, description }),
    };
  }
  return { action: "unchanged", issue: existing };
}

async function syncSubissues(
  task: ParsedTaskFile,
  teamId: string,
  mode: SyncMode,
  parentIssue: NormalizedIssueSummary | undefined,
): Promise<SyncSubissueResult[]> {
  const results: SyncSubissueResult[] = [];

  for (const subTask of task.subTasks) {
    const existing = await findIssueByTaskKey(teamId, subTask.key);
    const title = buildSubTaskIssueTitle(subTask);
    const description = buildSubTaskIssueDescription(task, subTask);

    if (!existing) {
      if (mode === "dry_run") {
        results.push({ key: subTask.key, action: "would_create" });
        continue;
      }
      if (!parentIssue) {
        throw new LinearValidationError(
          `Cannot create sub-task ${subTask.key} without a parent issue.`,
        );
      }
      results.push({
        key: subTask.key,
        action: "created",
        issue: await createIssue({
          teamId,
          title,
          description,
          parentId: parentIssue.id,
        }),
      });
      continue;
    }

    if (mode === "dry_run") {
      results.push({
        key: subTask.key,
        action: "would_update",
        issue: existing,
      });
    } else if (mode === "update_existing") {
      results.push({
        key: subTask.key,
        action: "updated",
        issue: await updateIssue({ issueId: existing.id, description }),
      });
    } else {
      results.push({ key: subTask.key, action: "unchanged", issue: existing });
    }
  }

  return results;
}

async function syncDependencyRelations(
  task: ParsedTaskFile,
  mode: SyncMode,
  parent: SyncIssueResult,
  subissues: SyncSubissueResult[],
): Promise<SyncRelationResult[]> {
  const issueByKey = new Map<string, NormalizedIssueSummary>();
  if (parent.issue) {
    issueByKey.set(task.id, parent.issue);
  }
  for (const subissue of subissues) {
    if (subissue.issue) {
      issueByKey.set(subissue.key, subissue.issue);
    }
  }

  const relations: SyncRelationResult[] = [];
  for (const subTask of task.subTasks) {
    if (subTask.blockedBy.length === 0) {
      continue;
    }

    if (mode === "dry_run") {
      relations.push({
        action: "would_create",
        issueKey: subTask.key,
        blockedBy: subTask.blockedBy,
      });
      continue;
    }

    const issue = issueByKey.get(subTask.key);
    if (!issue) {
      relations.push({
        action: "unchanged",
        issueKey: subTask.key,
        blockedBy: subTask.blockedBy,
      });
      continue;
    }

    const availableDependencies = subTask.blockedBy.filter((dependency) =>
      issueByKey.has(dependency),
    );
    for (const dependency of availableDependencies) {
      const dependencyIssue = issueByKey.get(dependency);
      if (!dependencyIssue) continue;
      await createIssueRelation({
        issueId: issue.id,
        relatedIssueId: dependencyIssue.id,
        type: "blocked_by",
      });
    }
    relations.push({
      action: availableDependencies.length > 0 ? "created" : "unchanged",
      issueKey: subTask.key,
      blockedBy: subTask.blockedBy,
    });
  }

  return relations;
}

async function findIssueByTaskKey(
  teamId: string,
  taskKey: string,
): Promise<NormalizedIssueSummary | undefined> {
  const result = await getLinearClient().searchIssues(taskKey, {
    first: 25,
    includeArchived: false,
    teamId,
  } as never);
  // Normalize pageInfo here to keep mocked SDK shape coverage aligned with other list/search tools.
  if (result.pageInfo) normalizePageInfo(result.pageInfo);
  const normalized = (result.nodes ?? []).map((issue) =>
    normalizeIssueSummary(issue),
  );
  const normalizedTaskKey = taskKey.toLowerCase();
  return normalized.find((issue) =>
    issue.title.toLowerCase().includes(normalizedTaskKey),
  );
}

function formatSyncResult(result: SyncTaskFileResult): string {
  const counts = new Map<string, number>();
  for (const item of [result.parent, ...result.subissues]) {
    counts.set(item.action, (counts.get(item.action) ?? 0) + 1);
  }
  for (const relation of result.relations ?? []) {
    counts.set(
      `relation_${relation.action}`,
      (counts.get(`relation_${relation.action}`) ?? 0) + 1,
    );
  }

  const summary = [...counts.entries()]
    .map(([action, count]) => `${action}: ${count}`)
    .join(", ");
  const parentLabel = result.parent.issue
    ? formatIssueSummary(result.parent.issue)
    : result.parent.action;
  return `Synced task file (${summary || "no changes"}). Parent: ${parentLabel}`;
}

function requireNonEmptyString(value: unknown, fieldName: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new LinearValidationError(`${fieldName} must be a non-empty string.`);
  }
  return value.trim();
}

function validateMode(value: unknown): SyncMode {
  if (value === undefined) {
    return "dry_run";
  }
  if (typeof value !== "string" || !syncModes.includes(value as SyncMode)) {
    throw new LinearValidationError(
      "mode must be one of create_missing, update_existing, or dry_run.",
    );
  }
  return value as SyncMode;
}

function optionalBoolean(
  value: unknown,
  fieldName: string,
): boolean | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "boolean") {
    throw new LinearValidationError(
      `${fieldName} must be a boolean when provided.`,
    );
  }
  return value;
}
