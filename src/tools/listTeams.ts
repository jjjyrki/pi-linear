import { defineTool } from '@mariozechner/pi-coding-agent';
import { Type } from '@mariozechner/pi-ai';

import { getLinearClient } from '../client.js';
import { LinearValidationError } from '../errors.js';
import { normalizeDiscoveryTeam, normalizePageInfo, type NormalizedTeam } from '../linear/shared.js';
import { validatePaginationFirst } from '../validation.js';

const listTeamsSchema = Type.Object({
  first: Type.Optional(Type.Number()),
  after: Type.Optional(Type.String()),
});

export async function listLinearTeams(input: Record<string, unknown>): Promise<{ teams: NormalizedTeam[]; pageInfo: ReturnType<typeof normalizePageInfo> }> {
  const first = validatePaginationFirst(input.first, { defaultValue: 25, maxValue: 100 });
  const after = optionalString(input.after, 'after');
  const connection = await getLinearClient().teams({ first, after } as never);

  return {
    teams: (connection.nodes ?? []).map(normalizeDiscoveryTeam),
    pageInfo: normalizePageInfo(connection.pageInfo),
  };
}

export const linearListTeamsTool = defineTool({
  name: 'linear_list_teams',
  label: 'List Teams',
  description: 'List Linear teams so agents can discover team IDs.',
  promptSnippet: 'List teams',
  promptGuidelines: ['Use linear_list_teams when teamId is unknown.'],
  parameters: listTeamsSchema,
  async execute(_toolCallId, input) {
    const result = await listLinearTeams(input as Record<string, unknown>);
    const teamLines = result.teams.map(formatTeamLine);
    const text = teamLines.length > 0
      ? [`Found ${result.teams.length} teams:`, ...teamLines].join('\n')
      : 'Found 0 teams';

    return {
      content: [{ type: 'text', text }],
      details: result,
    };
  },
});

function formatTeamLine(team: NormalizedTeam): string {
  const label = [team.key, team.name].filter(Boolean).join(' — ') || 'Unnamed team';
  return `- ${label} (id: ${team.id})`;
}

function optionalString(value: unknown, fieldName: string): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new LinearValidationError(`${fieldName} must be a non-empty string when provided.`);
  }
  return value;
}
