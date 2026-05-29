import type {
  NormalizedComment,
  NormalizedCycle,
  NormalizedIssueSummary,
  NormalizedLabel,
  NormalizedProject,
  NormalizedUser,
  NormalizedWorkflowState,
} from '../linear/shared.js';

import type { ListedIssueRelation } from './listIssueRelations.js';

export function formatIssueSummary(issue: NormalizedIssueSummary): string {
  const suffix = [issue.url, issue.parent?.identifier ? `parent: ${issue.parent.identifier}` : undefined, `id: ${issue.id}`]
    .filter(Boolean)
    .join(' | ');
  return `${issue.identifier}: ${issue.title}${suffix ? ` (${suffix})` : ''}`;
}

export function formatIssueLine(issue: NormalizedIssueSummary): string {
  return `- ${formatIssueSummary(issue)}`;
}

export function formatUserLine(user: NormalizedUser): string {
  const label = user.displayName ?? user.name ?? 'Unnamed user';
  const details = [user.email, `id: ${user.id}`].filter(Boolean).join(' | ');
  return `- ${label} (${details})`;
}

export function formatLabelLine(label: NormalizedLabel): string {
  const team = label.team?.key ?? label.team?.name;
  const metadata = [
    label.color,
    label.isGroup ? 'group' : undefined,
    team ? `team: ${team}` : undefined,
    `id: ${label.id}`,
  ].filter(Boolean).join(' | ');
  return `- ${label.name} (${metadata})`;
}

export function formatProjectLine(project: NormalizedProject): string {
  const status = project.status?.name ?? project.status?.type ?? project.state;
  const metadata = [
    status ? `status: ${status}` : undefined,
    project.slugId ? `slug: ${project.slugId}` : undefined,
    `id: ${project.id}`,
  ].filter(Boolean).join(' | ');
  return `- ${project.name} (${metadata})`;
}

export function formatCycleLine(cycle: NormalizedCycle): string {
  const title = cycle.name ?? `Cycle ${cycle.number}`;
  const team = cycle.team?.key ?? cycle.team?.name;
  const phase = cycle.isActive ? 'active' : cycle.isNext ? 'next' : cycle.isFuture ? 'future' : cycle.isPast ? 'past' : undefined;
  const metadata = [
    `number: ${cycle.number}`,
    phase,
    team ? `team: ${team}` : undefined,
    `id: ${cycle.id}`,
  ].filter(Boolean).join(' | ');
  return `- ${title} (${metadata})`;
}

export function formatWorkflowStateLine(state: NormalizedWorkflowState): string {
  const team = state.team?.key ?? state.team?.name;
  const metadata = [state.type, team ? `team: ${team}` : undefined, `id: ${state.id}`].filter(Boolean).join(' | ');
  return `- ${state.name} (${metadata})`;
}

export function formatCommentLine(comment: NormalizedComment): string {
  const author = comment.user?.displayName ?? comment.user?.name;
  const metadata = [
    author ? `user: ${author}` : undefined,
    comment.parentId ? `parent: ${comment.parentId}` : undefined,
    comment.createdAt,
    `id: ${comment.id}`,
  ].filter(Boolean).join(' | ');
  return `- ${comment.body}${metadata ? ` (${metadata})` : ''}`;
}

export function formatIssueRelationLine(relation: ListedIssueRelation): string {
  const description = relation.type === 'blocks'
    ? `blocks ${relation.counterpartIssue.identifier}`
    : relation.type === 'blocked_by'
      ? `is blocked by ${relation.counterpartIssue.identifier}`
      : `is related to ${relation.counterpartIssue.identifier}`;
  const metadata = [relation.counterpartIssue.title, relation.updatedAt ?? relation.createdAt, `id: ${relation.id}`]
    .filter(Boolean)
    .join(' | ');
  return `- ${description}${metadata ? ` (${metadata})` : ''}`;
}
