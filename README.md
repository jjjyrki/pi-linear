# pi-linear

Pi extension for working with Linear.

## Setup

1. Create a [Linear personal API key](https://linear.app/settings/api) for the workspace you want to use.
2. Export it in the same shell that starts Pi:

```bash
export LINEAR_API_KEY="lin_api_..."
```

3. Load the extension in Pi (see `docs/linear-extension-prd.md` for install and slash commands).
4. Run `/linear-status` to verify configuration. The command never prints the key value.

### API key permissions

Personal API keys act as the creating user. They can read and mutate issues, comments, and discovery data that user can access in Linear. Use a dedicated key for automation, rotate it if exposed, and revoke keys you no longer need.

## Discovery before mutation

Issue create and update tools accept relationship IDs (`labelIds`, `projectId`, `cycleId`, `stateId`, `assigneeId`, `teamId`). Resolve IDs with list tools before mutating:

| Field | Tool |
| --- | --- |
| `teamId` | `linear_list_teams` |
| `labelIds` | `linear_list_labels` |
| `projectId` | `linear_list_projects` |
| `cycleId` | `linear_list_cycles` |
| `stateId` | `linear_list_workflow_states` |
| `assigneeId` | `linear_list_users` |

Run `/linear-tools` in Pi for required inputs per tool.

For issue dependencies, use `linear_list_issue_relations` to inspect existing relations and `linear_delete_issue_relation` to remove a specific relation by ID.

## Troubleshooting

| Symptom | What to check |
| --- | --- |
| `/linear-status` warns key is not set | Export `LINEAR_API_KEY` in the shell that launches Pi, then reload. |
| `/linear-status` warns key is empty | Remove whitespace-only values; set a valid `lin_api_...` key. |
| Authentication rejected | Regenerate the personal API key in Linear settings and update the env var. |
| Permission denied | Confirm the key’s user has access to the team/issue/workspace. |
| Rate limited | Wait and retry; avoid tight loops of tool calls. |
| Network errors | Check VPN/firewall access to Linear’s API endpoints. |

Tool and command errors are normalized to actionable messages and redact configured API keys.

## Development

```bash
npm run ci
```
