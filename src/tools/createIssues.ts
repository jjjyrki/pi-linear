import { defineTool } from "@mariozechner/pi-coding-agent";
import { Type } from "@mariozechner/pi-ai";

import { getLinearClient } from "../client.js";
import { LinearValidationError } from "../errors.js";
import { formatSafeErrorMessage } from "../linear/errorHandling.js";
import {
  dueDateSchema,
  optionalTextSchema,
  prioritySchema,
} from "../schemas.js";
import { type NormalizedIssueSummary } from "../linear/shared.js";
import {
  buildIssueCreatePayload,
  createIssueWithPayload,
  validateIssueCreateInput,
  type IssueCreatePayload,
  type ValidatedIssueCreateInput,
} from "./createIssue.js";
import { formatIssueLine } from "./format.js";

const bulkIssueSchema = Type.Object({
  title: Type.String(),
  description: optionalTextSchema,
  parentId: Type.Optional(Type.String()),
  priority: Type.Optional(prioritySchema),
  labelIds: Type.Optional(Type.Array(Type.String())),
  projectId: Type.Optional(Type.String()),
  cycleId: Type.Optional(Type.String()),
  stateId: Type.Optional(Type.String()),
  assigneeId: Type.Optional(Type.String()),
  estimate: Type.Optional(Type.Number()),
  dueDate: Type.Optional(dueDateSchema),
});

const createIssuesSchema = Type.Object({
  teamId: Type.String(),
  issues: Type.Array(bulkIssueSchema),
});

export type BulkCreateIssuesResult = {
  issues: NormalizedIssueSummary[];
};

export async function createIssues(
  input: Record<string, unknown>,
): Promise<BulkCreateIssuesResult> {
  const teamId = requireNonEmptyString(input.teamId, "teamId");
  const issueInputs = validateIssueArray(input.issues);
  const client = getLinearClient();

  const validated = issueInputs.map((issueInput) =>
    validateIssueCreateInput(issueInput, { teamId }),
  );
  const payloads: IssueCreatePayload[] = [];
  for (const issueInput of validated) {
    payloads.push(await buildIssueCreatePayload(client, issueInput));
  }

  const created: NormalizedIssueSummary[] = [];
  for (let index = 0; index < payloads.length; index += 1) {
    try {
      created.push(await createIssueWithPayload(client, payloads[index]));
    } catch (error) {
      throw createBulkCreateError(error, validated[index], index, created);
    }
  }

  return { issues: created };
}

export const linearCreateIssuesTool = defineTool({
  name: "linear_create_issues",
  label: "Create Issues",
  description:
    "Create multiple Linear issues with one shared team ID and optional metadata.",
  promptSnippet: "Create several issues",
  promptGuidelines: ["Use linear_create_issues for independent issues in one team after duplicate checks."],
  parameters: createIssuesSchema,
  async execute(_toolCallId, input) {
    const result = await createIssues(input as Record<string, unknown>);
    const issueLines = result.issues.map(formatIssueLine);
    const text = [
      `Created ${result.issues.length} issues:`,
      ...issueLines,
    ].join("\n");

    return {
      content: [{ type: "text", text }],
      details: result,
    };
  },
});

function validateIssueArray(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new LinearValidationError("issues must be a non-empty array.");
  }
  if (
    value.some(
      (issue) => !issue || typeof issue !== "object" || Array.isArray(issue),
    )
  ) {
    throw new LinearValidationError("issues must contain issue input objects.");
  }
  return value as Record<string, unknown>[];
}

function requireNonEmptyString(value: unknown, fieldName: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new LinearValidationError(`${fieldName} must be a non-empty string.`);
  }
  return value;
}

function createBulkCreateError(
  error: unknown,
  failedInput: ValidatedIssueCreateInput,
  index: number,
  created: NormalizedIssueSummary[],
): Error {
  const createdContext =
    created.length > 0
      ? ` Created before failure: ${created.map((issue) => issue.identifier).join(", ")}.`
      : "";
  return new Error(
    `Failed to create issue ${index + 1} (${failedInput.title}): ${formatSafeErrorMessage(error, { operation: "linear_create_issues" })}.${createdContext}`,
  );
}
