# pi-linear

Pi extension for working with Linear.

## Setup

Set `LINEAR_API_KEY` and load the extension in Pi (see `docs/linear-extension-prd.md` for install and slash commands).

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

## Development

```bash
npm run ci
```
