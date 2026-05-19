import { LinearClient } from '@linear/sdk';

import { LinearConfigurationError, LinearNotFoundError, LinearValidationError } from '../errors.js';

export type FriendlyPriority = 'no_priority' | 'urgent' | 'high' | 'medium' | 'low';

export const friendlyPriorities = [
  'no_priority',
  'urgent',
  'high',
  'medium',
  'low',
] as const satisfies readonly FriendlyPriority[];

const priorityValueToFriendly: Record<number, FriendlyPriority> = {
  0: 'no_priority',
  1: 'urgent',
  2: 'high',
  3: 'medium',
  4: 'low',
};

const friendlyPriorityToValue: Record<FriendlyPriority, number> = {
  no_priority: 0,
  urgent: 1,
  high: 2,
  medium: 3,
  low: 4,
};

const linearUuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const dueDatePattern = /^\d{4}-\d{2}-\d{2}$/;

export type NormalizedUser = {
  id: string;
  displayName?: string;
  name?: string;
  email?: string;
};

export type NormalizedTeam = {
  id: string;
  key?: string;
  name?: string;
};

export type NormalizedWorkflowState = {
  id: string;
  name: string;
  type?: string;
  team?: NormalizedTeam;
};

export type NormalizedLabel = {
  id: string;
  name: string;
  color?: string;
  description?: string;
  isGroup?: boolean;
  team?: NormalizedTeam;
};

export type NormalizedProjectStatus = {
  id: string;
  name?: string;
  type?: string;
};

export type NormalizedProject = {
  id: string;
  name: string;
  slugId?: string;
  url?: string;
  description?: string;
  color?: string;
  state?: string;
  status?: NormalizedProjectStatus;
};

export type NormalizedCycle = {
  id: string;
  number: number;
  name?: string;
  description?: string;
  startsAt?: string;
  endsAt?: string;
  isActive?: boolean;
  isFuture?: boolean;
  isPast?: boolean;
  isNext?: boolean;
  isPrevious?: boolean;
  team?: NormalizedTeam;
};

export type NormalizedIssueParent = {
  id: string;
  identifier?: string;
  title?: string;
};

export type NormalizedIssueSummary = {
  id: string;
  identifier: string;
  title: string;
  url?: string;
  parent?: NormalizedIssueParent;
  state?: { id: string; name: string; type?: string };
  assignee?: NormalizedUser;
  team?: NormalizedTeam;
  priority?: { value: FriendlyPriority; label: string };
  labels?: { id: string; name: string; color?: string }[];
  estimate?: number | null;
  dueDate?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type NormalizedIssue = NormalizedIssueSummary & {
  description?: string | null;
};

export type NormalizedComment = {
  id: string;
  body: string;
  url?: string;
  parentId?: string;
  issue?: { id: string; identifier?: string; title?: string };
  user?: { id: string; displayName?: string; name?: string };
  createdAt?: string;
  updatedAt?: string;
  editedAt?: string;
};

export type NormalizedPageInfo = {
  endCursor?: string | null;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  startCursor?: string | null;
};

export type LinearIssueResolverClient = Pick<LinearClient, 'issue'>;

export function isNonEmptyTrimmedString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export function isWhitespaceOnlyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.trim().length === 0;
}

export function isLinearUuid(value: string): boolean {
  return linearUuidPattern.test(value);
}

export function validateTitle(value: unknown): string {
  if (!isNonEmptyTrimmedString(value)) {
    throw new LinearValidationError('title must be a non-empty string.');
  }
  return value;
}

export function validateDescription(value: unknown, options?: { allowEmpty?: boolean }): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== 'string') {
    throw new LinearValidationError('description must be a string.');
  }
  if (value.length === 0) {
    if (options?.allowEmpty) {
      return value;
    }
    throw new LinearValidationError('description must not be empty.');
  }
  if (!isNonEmptyTrimmedString(value)) {
    throw new LinearValidationError('description must not be blank.');
  }
  return value;
}

export function validateCommentBody(value: unknown): string {
  if (!isNonEmptyTrimmedString(value)) {
    throw new LinearValidationError('body must be a non-empty string.');
  }
  return value;
}

export function validateDueDate(value: unknown): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== 'string' || !dueDatePattern.test(value)) {
    throw new LinearValidationError('dueDate must use YYYY-MM-DD format.');
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new LinearValidationError('dueDate must be a valid calendar date in YYYY-MM-DD format.');
  }

  return value;
}

export function validatePaginationFirst(value: unknown, options?: { defaultValue?: number; maxValue?: number }): number {
  const defaultValue = options?.defaultValue ?? 25;
  const maxValue = options?.maxValue ?? 100;

  if (value === undefined) {
    return defaultValue;
  }

  if (!Number.isInteger(value) || typeof value !== 'number' || value <= 0) {
    throw new LinearValidationError('first must be a positive integer.');
  }

  if (value > maxValue) {
    throw new LinearValidationError(`first must be at most ${maxValue}.`);
  }

  return value;
}

export function mapPriorityInputToLinear(value: unknown): number | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!isFriendlyPriority(value)) {
    throw new LinearValidationError('priority must be one of no_priority, urgent, high, medium, or low.');
  }
  return friendlyPriorityToValue[value];
}

export function mapPriorityOutput(value: unknown, label?: unknown): { value: FriendlyPriority; label: string } | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  const friendly = typeof value === 'number' && value in priorityValueToFriendly
    ? priorityValueToFriendly[value as keyof typeof priorityValueToFriendly]
    : undefined;

  if (!friendly) {
    return undefined;
  }

  return {
    value: friendly,
    label: typeof label === 'string' && label.length > 0 ? label : formatFriendlyPriorityLabel(friendly),
  };
}

export function normalizeIsoDateTime(value: unknown): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value === 'string') {
    return value;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  return undefined;
}

export function normalizeUserSummary(value: unknown, options?: { includeEmail?: boolean }): NormalizedUser | undefined {
  if (typeof value === 'string') {
    return { id: value };
  }
  if (!value || typeof value !== 'object') {
    return undefined;
  }

  const candidate = value as Record<string, unknown>;
  const id = getString(candidate.id);
  if (!id) {
    return undefined;
  }

  const summary: NormalizedUser = { id };
  const displayName = getString(candidate.displayName);
  const name = getString(candidate.name);
  const email = getString(candidate.email);

  if (displayName) summary.displayName = displayName;
  if (name) summary.name = name;
  if (options?.includeEmail && email) summary.email = email;

  return summary;
}

export function normalizeTeamSummary(value: unknown): NormalizedTeam | undefined {
  if (typeof value === 'string') {
    return { id: value };
  }
  if (!value || typeof value !== 'object') {
    return undefined;
  }

  const candidate = value as Record<string, unknown>;
  const id = getString(candidate.id);
  if (!id) {
    return undefined;
  }

  const summary: NormalizedTeam = { id };
  const key = getString(candidate.key);
  const name = getString(candidate.name);

  if (key) summary.key = key;
  if (name) summary.name = name;

  return summary;
}

export function normalizeWorkflowStateSummary(value: unknown): NormalizedWorkflowState | undefined {
  if (typeof value === 'string') {
    return { id: value, name: value };
  }
  if (!value || typeof value !== 'object') {
    return undefined;
  }

  const candidate = value as Record<string, unknown>;
  const id = getString(candidate.id);
  const name = getString(candidate.name);
  if (!id || !name) {
    return undefined;
  }

  const summary: NormalizedWorkflowState = { id, name };
  const type = getString(candidate.type);
  const team = normalizeTeamSummary(candidate.team ?? candidate.teamId);

  if (type) summary.type = type;
  if (team) summary.team = team;

  return summary;
}

export function normalizeIssueSummary(value: unknown): NormalizedIssueSummary {
  if (!value || typeof value !== 'object') {
    throw new LinearValidationError('issue data is missing or invalid.');
  }

  const candidate = value as Record<string, unknown>;
  const id = getString(candidate.id);
  const identifier = getString(candidate.identifier);
  const title = getString(candidate.title);

  if (!id || !identifier || !title) {
    throw new LinearValidationError('issue data is missing required fields.');
  }

  const summary: NormalizedIssueSummary = { id, identifier, title };
  const url = getString(candidate.url);
  const parent = normalizeIssueParent(candidate.parent ?? candidate.parentId);
  const state = normalizeWorkflowStateForIssue(candidate.state ?? candidate.stateId);
  const assignee = normalizeUserSummary(candidate.assignee ?? candidate.assigneeId, { includeEmail: false });
  const team = normalizeTeamSummary(candidate.team ?? candidate.teamId);
  const priority = mapPriorityOutput(candidate.priority, candidate.priorityLabel);
  const labels = normalizeLabels(candidate.labels);
  const estimate = normalizeOptionalNumber(candidate.estimate);
  const dueDate = normalizeOptionalString(candidate.dueDate);
  const createdAt = normalizeIsoDateTime(candidate.createdAt);
  const updatedAt = normalizeIsoDateTime(candidate.updatedAt);

  if (url) summary.url = url;
  if (parent) summary.parent = parent;
  if (state) summary.state = state;
  if (assignee) summary.assignee = assignee;
  if (team) summary.team = team;
  if (priority) summary.priority = priority;
  if (labels) summary.labels = labels;
  if (estimate !== undefined) summary.estimate = estimate;
  if (dueDate !== undefined) summary.dueDate = dueDate;
  if (createdAt) summary.createdAt = createdAt;
  if (updatedAt) summary.updatedAt = updatedAt;

  return summary;
}

export function normalizeIssue(value: unknown): NormalizedIssue {
  const summary = normalizeIssueSummary(value) as NormalizedIssue;
  const candidate = value as Record<string, unknown>;
  const description = candidate.description;

  if (description === null) {
    summary.description = null;
  } else if (typeof description === 'string') {
    summary.description = description;
  }

  return summary;
}

export function normalizeComment(value: unknown): NormalizedComment {
  if (!value || typeof value !== 'object') {
    throw new LinearValidationError('comment data is missing or invalid.');
  }

  const candidate = value as Record<string, unknown>;
  const id = getString(candidate.id);
  const body = getString(candidate.body);
  if (!id || !body) {
    throw new LinearValidationError('comment data is missing required fields.');
  }

  const comment: NormalizedComment = { id, body };
  const url = getString(candidate.url);
  const parentId = getString(candidate.parentId);
  const issue = normalizeCommentIssue(candidate.issue ?? candidate.issueId);
  const user = normalizeCommentUser(candidate.user ?? candidate.userId);
  const createdAt = normalizeIsoDateTime(candidate.createdAt);
  const updatedAt = normalizeIsoDateTime(candidate.updatedAt);
  const editedAt = normalizeIsoDateTime(candidate.editedAt);

  if (url) comment.url = url;
  if (parentId) comment.parentId = parentId;
  if (issue) comment.issue = issue;
  if (user) comment.user = user;
  if (createdAt) comment.createdAt = createdAt;
  if (updatedAt) comment.updatedAt = updatedAt;
  if (editedAt) comment.editedAt = editedAt;

  return comment;
}

export function normalizeViewer(value: unknown): NormalizedUser {
  const viewer = normalizeUserSummary(value, { includeEmail: true });
  if (!viewer) {
    throw new LinearValidationError('viewer data is missing required fields.');
  }
  return viewer;
}

export function normalizeDiscoveryUser(value: unknown): NormalizedUser {
  const user = normalizeUserSummary(value, { includeEmail: true });
  if (!user) {
    throw new LinearValidationError('user data is missing required fields.');
  }
  return user;
}

export function normalizeDiscoveryTeam(value: unknown): NormalizedTeam {
  const team = normalizeTeamSummary(value);
  if (!team) {
    throw new LinearValidationError('team data is missing required fields.');
  }
  return team;
}

export function normalizeDiscoveryWorkflowState(value: unknown): NormalizedWorkflowState {
  const workflowState = normalizeWorkflowStateSummary(value);
  if (!workflowState) {
    throw new LinearValidationError('workflow state data is missing required fields.');
  }
  return workflowState;
}

export function normalizeDiscoveryLabel(value: unknown): NormalizedLabel {
  const label = normalizeLabelSummary(value);
  if (!label) {
    throw new LinearValidationError('label data is missing required fields.');
  }
  return label;
}

export function normalizeDiscoveryProject(value: unknown): NormalizedProject {
  const project = normalizeProjectSummary(value);
  if (!project) {
    throw new LinearValidationError('project data is missing required fields.');
  }
  return project;
}

export function normalizeDiscoveryCycle(value: unknown): NormalizedCycle {
  const cycle = normalizeCycleSummary(value);
  if (!cycle) {
    throw new LinearValidationError('cycle data is missing required fields.');
  }
  return cycle;
}

export function normalizePageInfo(value: unknown): NormalizedPageInfo {
  if (!value || typeof value !== 'object') {
    throw new LinearValidationError('pageInfo data is missing or invalid.');
  }

  const candidate = value as Record<string, unknown>;
  return {
    endCursor: normalizeOptionalString(candidate.endCursor),
    hasNextPage: Boolean(candidate.hasNextPage),
    hasPreviousPage: Boolean(candidate.hasPreviousPage),
    startCursor: normalizeOptionalString(candidate.startCursor),
  };
}

export async function resolveIssueReference(
  client: LinearIssueResolverClient,
  issueReference: string,
): Promise<{ id: string; identifier: string; title: string }> {
  const trimmed = issueReference.trim();
  if (!isNonEmptyTrimmedString(trimmed)) {
    throw new LinearValidationError('issueId must be a non-empty string.');
  }

  const issue = await client.issue(trimmed);
  if (!issue) {
    throw new LinearNotFoundError(`Issue not found: ${trimmed}`);
  }

  const normalized = normalizeIssueSummary(issue);
  return {
    id: normalized.id,
    identifier: normalized.identifier,
    title: normalized.title,
  };
}

export function createLinearClientFromToken(apiKey: string): LinearClient {
  if (!isNonEmptyTrimmedString(apiKey)) {
    throw new LinearConfigurationError('Set LINEAR_API_KEY to use Linear tools.');
  }

  return new LinearClient({ apiKey });
}

function isFriendlyPriority(value: unknown): value is FriendlyPriority {
  return typeof value === 'string' && (friendlyPriorities as readonly string[]).includes(value);
}

function formatFriendlyPriorityLabel(value: FriendlyPriority): string {
  return value === 'no_priority'
    ? 'No priority'
    : `${value.charAt(0).toUpperCase()}${value.slice(1).replaceAll('_', ' ')}`;
}

function getString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function normalizeOptionalString(value: unknown): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return null;
  }
  return typeof value === 'string' ? value : undefined;
}

function normalizeOptionalNumber(value: unknown): number | null | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return null;
  }
  return typeof value === 'number' ? value : undefined;
}

function normalizeIssueParent(value: unknown): NormalizedIssueParent | undefined {
  if (typeof value === 'string') {
    return { id: value };
  }
  if (!value || typeof value !== 'object') {
    return undefined;
  }
  const candidate = value as Record<string, unknown>;
  const id = getString(candidate.id);
  if (!id) {
    return undefined;
  }
  const parent: NormalizedIssueParent = { id };
  const identifier = getString(candidate.identifier);
  const title = getString(candidate.title);
  if (identifier) parent.identifier = identifier;
  if (title) parent.title = title;
  return parent;
}

function normalizeLabelSummary(value: unknown): NormalizedLabel | undefined {
  if (!value || typeof value !== 'object') {
    return undefined;
  }

  const candidate = value as Record<string, unknown>;
  const id = getString(candidate.id);
  const name = getString(candidate.name);
  if (!id || !name) {
    return undefined;
  }

  const label: NormalizedLabel = { id, name };
  const color = getString(candidate.color);
  const description = getString(candidate.description);
  const team = normalizeTeamSummary(candidate.team ?? candidate.teamId);

  if (color) label.color = color;
  if (description) label.description = description;
  if (typeof candidate.isGroup === 'boolean') label.isGroup = candidate.isGroup;
  if (team) label.team = team;

  return label;
}

function normalizeProjectStatusSummary(value: unknown): NormalizedProjectStatus | undefined {
  if (typeof value === 'string') {
    return { id: value };
  }
  if (!value || typeof value !== 'object') {
    return undefined;
  }

  const candidate = value as Record<string, unknown>;
  const id = getString(candidate.id);
  if (!id) {
    return undefined;
  }

  const status: NormalizedProjectStatus = { id };
  const name = getString(candidate.name);
  const type = getString(candidate.type);
  if (name) status.name = name;
  if (type) status.type = type;
  return status;
}

function normalizeProjectSummary(value: unknown): NormalizedProject | undefined {
  if (!value || typeof value !== 'object') {
    return undefined;
  }

  const candidate = value as Record<string, unknown>;
  const id = getString(candidate.id);
  const name = getString(candidate.name);
  if (!id || !name) {
    return undefined;
  }

  const project: NormalizedProject = { id, name };
  const slugId = getString(candidate.slugId);
  const url = getString(candidate.url);
  const description = getString(candidate.description);
  const color = getString(candidate.color);
  const state = getString(candidate.state);
  const status = normalizeProjectStatusSummary(candidate.status);

  if (slugId) project.slugId = slugId;
  if (url) project.url = url;
  if (description) project.description = description;
  if (color) project.color = color;
  if (state) project.state = state;
  if (status) project.status = status;

  return project;
}

function normalizeCycleSummary(value: unknown): NormalizedCycle | undefined {
  if (!value || typeof value !== 'object') {
    return undefined;
  }

  const candidate = value as Record<string, unknown>;
  const id = getString(candidate.id);
  if (!id) {
    return undefined;
  }

  const number = typeof candidate.number === 'number' ? candidate.number : undefined;
  if (number === undefined) {
    return undefined;
  }

  const cycle: NormalizedCycle = { id, number };
  const name = getString(candidate.name);
  const description = getString(candidate.description);
  const startsAt = normalizeIsoDateTime(candidate.startsAt);
  const endsAt = normalizeIsoDateTime(candidate.endsAt);
  const team = normalizeTeamSummary(candidate.team ?? candidate.teamId);

  if (name) cycle.name = name;
  if (description) cycle.description = description;
  if (startsAt) cycle.startsAt = startsAt;
  if (endsAt) cycle.endsAt = endsAt;
  if (typeof candidate.isActive === 'boolean') cycle.isActive = candidate.isActive;
  if (typeof candidate.isFuture === 'boolean') cycle.isFuture = candidate.isFuture;
  if (typeof candidate.isPast === 'boolean') cycle.isPast = candidate.isPast;
  if (typeof candidate.isNext === 'boolean') cycle.isNext = candidate.isNext;
  if (typeof candidate.isPrevious === 'boolean') cycle.isPrevious = candidate.isPrevious;
  if (team) cycle.team = team;

  return cycle;
}

function normalizeLabels(value: unknown): { id: string; name: string; color?: string }[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const labels = value
    .map((label) => {
      if (!label || typeof label !== 'object') {
        return undefined;
      }
      const candidate = label as Record<string, unknown>;
      const id = getString(candidate.id);
      const name = getString(candidate.name);
      if (!id || !name) {
        return undefined;
      }
      const normalized: { id: string; name: string; color?: string } = { id, name };
      const color = getString(candidate.color);
      if (color) normalized.color = color;
      return normalized;
    })
    .filter((label): label is { id: string; name: string; color?: string } => Boolean(label));

  return labels.length > 0 ? labels : undefined;
}

function normalizeWorkflowStateForIssue(value: unknown): { id: string; name: string; type?: string } | undefined {
  if (typeof value === 'string') {
    return { id: value, name: value };
  }
  if (!value || typeof value !== 'object') {
    return undefined;
  }
  const candidate = value as Record<string, unknown>;
  const id = getString(candidate.id);
  const name = getString(candidate.name);
  if (!id || !name) {
    return undefined;
  }
  const state: { id: string; name: string; type?: string } = { id, name };
  const type = getString(candidate.type);
  if (type) state.type = type;
  return state;
}

function normalizeCommentIssue(value: unknown): { id: string; identifier?: string; title?: string } | undefined {
  if (typeof value === 'string') {
    return { id: value };
  }
  if (!value || typeof value !== 'object') {
    return undefined;
  }
  const candidate = value as Record<string, unknown>;
  const id = getString(candidate.id);
  if (!id) {
    return undefined;
  }
  const issue: { id: string; identifier?: string; title?: string } = { id };
  const identifier = getString(candidate.identifier);
  const title = getString(candidate.title);
  if (identifier) issue.identifier = identifier;
  if (title) issue.title = title;
  return issue;
}

function normalizeCommentUser(value: unknown): { id: string; displayName?: string; name?: string } | undefined {
  if (typeof value === 'string') {
    return { id: value };
  }
  if (!value || typeof value !== 'object') {
    return undefined;
  }
  const candidate = value as Record<string, unknown>;
  const id = getString(candidate.id);
  if (!id) {
    return undefined;
  }
  const user: { id: string; displayName?: string; name?: string } = { id };
  const displayName = getString(candidate.displayName);
  const name = getString(candidate.name);
  if (displayName) user.displayName = displayName;
  if (name) user.name = name;
  return user;
}
