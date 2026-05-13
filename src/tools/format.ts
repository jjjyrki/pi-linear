import type { NormalizedComment, NormalizedIssueSummary, NormalizedUser, NormalizedWorkflowState } from '../linear/shared.js';

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
