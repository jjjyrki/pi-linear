import { defineTool } from "@mariozechner/pi-coding-agent";
import { Type } from "@mariozechner/pi-ai";

import { getLinearClient } from "../client.js";
import { LinearValidationError } from "../errors.js";
import { optionalTextSchema } from "../schemas.js";
import { type NormalizedIssueSummary } from "../linear/shared.js";
import {
  buildIssueCreatePayload,
  createIssueWithPayload,
  validateIssueCreateInput,
  type IssueCreatePayload,
  type ValidatedIssueCreateInput,
} from "./createIssue.js";
import { formatIssueLine, formatIssueSummary } from "./format.js";

const issueInputSchema = Type.Object({
  title: Type.String(),
  description: optionalTextSchema,
});

const createIssueWithSubissuesSchema = Type.Object({
  teamId: Type.String(),
  parent: issueInputSchema,
  subissues: Type.Array(issueInputSchema),
});

export type CreateIssueWithSubissuesResult = {
  parent: NormalizedIssueSummary;
  subissues: NormalizedIssueSummary[];
};

export async function createIssueWithSubissues(
  input: Record<string, unknown>,
): Promise<CreateIssueWithSubissuesResult> {
  const teamId = requireNonEmptyString(input.teamId, "teamId");
  const parentInput = validateIssueObject(input.parent, "parent");
  const subissueInputs = validateSubissueArray(input.subissues);
  const client = getLinearClient();

  const validatedParent = validateIssueCreateInput(parentInput, { teamId });
  const validatedSubissues = subissueInputs.map((subissue) =>
    validateIssueCreateInput(subissue, { teamId }),
  );

  const parentPayload = await buildIssueCreatePayload(client, validatedParent);
  const parent = await createIssueWithPayload(client, parentPayload);

  const subissuePayloads = validatedSubissues.map((subissue) =>
    buildSubissuePayload(subissue, parent.id),
  );
  const subissues: NormalizedIssueSummary[] = [];
  for (let index = 0; index < subissuePayloads.length; index += 1) {
    try {
      subissues.push(
        await createIssueWithPayload(client, subissuePayloads[index]),
      );
    } catch (error) {
      throw createSubissueError(
        error,
        parent,
        validatedSubissues[index],
        index,
        subissues,
      );
    }
  }

  return { parent, subissues };
}

export const linearCreateIssueWithSubissuesTool = defineTool({
  name: "linear_create_issue_with_subissues",
  label: "Create Issue With Sub-Issues",
  description:
    "Create one parent Linear issue and multiple sub-issues under it.",
  parameters: createIssueWithSubissuesSchema,
  async execute(_toolCallId, input) {
    const result = await createIssueWithSubissues(
      input as Record<string, unknown>,
    );
    const subissueLines = result.subissues.map(formatIssueLine);
    const text = [
      `Created parent ${formatIssueSummary(result.parent)}`,
      ...subissueLines,
    ].join("\n");

    return {
      content: [{ type: "text", text }],
      details: result,
    };
  },
});

function buildSubissuePayload(
  input: ValidatedIssueCreateInput,
  parentId: string,
): IssueCreatePayload {
  return {
    teamId: input.teamId,
    title: input.title,
    description: input.description,
    assigneeId: input.assigneeId,
    stateId: input.stateId,
    priority: input.priority,
    labelIds: input.labelIds,
    estimate: input.estimate,
    dueDate: input.dueDate,
    parentId,
  };
}

function validateIssueObject(
  value: unknown,
  fieldName: string,
): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new LinearValidationError(
      `${fieldName} must be an issue input object.`,
    );
  }
  return value as Record<string, unknown>;
}

function validateSubissueArray(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new LinearValidationError("subissues must be a non-empty array.");
  }
  return value.map((subissue, index) =>
    validateIssueObject(subissue, `subissues[${index}]`),
  );
}

function requireNonEmptyString(value: unknown, fieldName: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new LinearValidationError(`${fieldName} must be a non-empty string.`);
  }
  return value;
}

function createSubissueError(
  error: unknown,
  parent: NormalizedIssueSummary,
  failedInput: ValidatedIssueCreateInput,
  index: number,
  createdSubissues: NormalizedIssueSummary[],
): Error {
  const createdContext =
    createdSubissues.length > 0
      ? ` Created sub-issues before failure: ${createdSubissues.map((issue) => issue.identifier).join(", ")}.`
      : "";
  return new Error(
    `Failed to create sub-issue ${index + 1} (${failedInput.title}) under ${parent.identifier}: ${getErrorMessage(error)}.${createdContext}`,
  );
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }
  return "unknown error";
}
