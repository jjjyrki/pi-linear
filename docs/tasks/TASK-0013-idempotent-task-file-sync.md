id: TASK-0013
status: done
summary: Add idempotent Linear sync from task markdown files

# Goal
Turn a task markdown file into a synchronized Linear parent issue, sub-issues, and optional dependencies without duplicating existing issues.

# Problem
Task-file to Linear issue creation currently requires manual search, manual parent creation, repeated sub-issue creation, and dependency text in descriptions. Agents need a safe high-level workflow that can be re-run.

# Dependencies
- `TASK-0008` for reliable team ID discovery.
- `TASK-0009` for finding existing issues by task ID or title.
- `TASK-0010` for bulk issue creation.
- `TASK-0012` for native dependency relation creation.

# Scope
In scope:
- Add a new `linear_sync_task_file` tool.
- Read task metadata from a local markdown task file.
- Find or create the parent Linear issue.
- Parse implementation sub-tasks and create missing sub-issues.
- Update descriptions when requested.
- Preserve existing issue state, assignee, comments, and other ownership metadata.
- Optionally create dependency relations.
- Support dry-run reporting.

Out of scope:
- Arbitrary markdown project management formats unrelated to local task files.
- Deleting Linear issues when task-file sections are removed.
- Changing existing issue state, assignee, labels, estimates, comments, or priority.
- Branch guidance generation; see `TASK-0015`.

# Functional requirements
## Input
```ts
linear_sync_task_file({
  teamId: string,
  taskFilePath: string,
  mode: "create_missing" | "update_existing" | "dry_run",
  createSubtasks: boolean,
  linkDependencies: boolean
})
```

- `teamId` must be non-empty.
- `taskFilePath` must point to a readable markdown file.
- `mode` defaults may be chosen during implementation, but the tool must expose all three modes.
- `createSubtasks` controls whether missing parsed sub-tasks are created.
- `linkDependencies` controls whether parsed dependencies create Linear relations.

## Task file parsing
- Read the task ID and summary from the required header:
  ```text
  id: TASK-XXXX
  status: <status>
  summary: <summary>
  ```
- Use the task ID as the primary idempotency key.
- Parse implementation sub-tasks from a `# Implementation sub-tasks` section in the repository's established task-file format.
- Extract dependency references from sub-task metadata when present in a deterministic, documented format.
- Produce clear validation errors for unsupported or ambiguous task-file structure.

## Sync behavior
- Search for an existing parent issue by task ID before creating one.
- Create the parent if missing and mode permits creation.
- Create missing sub-issues when `createSubtasks` is true and mode permits creation.
- Update existing parent and sub-issue descriptions only in `update_existing` mode.
- Never change existing issue state, assignee, comments, or other ownership metadata.
- In `dry_run`, perform no mutations and return the planned creates, updates, and relations.

## Output
```ts
{
  parent: {
    action: "created" | "updated" | "unchanged" | "would_create" | "would_update"
    issue?: { id: string; identifier: string; title: string; url?: string }
  },
  subissues: Array<{
    action: "created" | "updated" | "unchanged" | "would_create" | "would_update"
    key: string
    issue?: { id: string; identifier: string; title: string; url?: string }
  }>,
  relations?: Array<{
    action: "created" | "unchanged" | "would_create"
    issueKey: string
    blockedBy: string[]
  }>
}
```

- Visible content must summarize created, updated, unchanged, and dry-run planned work.

# Acceptance criteria
- [x] Re-running sync does not create duplicate parent issues.
- [x] Re-running sync does not create duplicate sub-issues.
- [x] `dry_run` reports planned work without mutations.
- [x] `create_missing` creates only missing parent/sub-issues and preserves existing descriptions.
- [x] `update_existing` updates descriptions without changing state, assignee, or comments.
- [x] `linkDependencies` creates native Linear dependency relations when dependencies are parsed.

# Testing expectations
- Unit-test task header parsing.
- Unit-test sub-task parsing with representative task files.
- Unit-test parent idempotency using search results.
- Unit-test missing sub-issue creation and duplicate avoidance.
- Unit-test `dry_run`, `create_missing`, and `update_existing` behavior.
- Unit-test dependency relation planning and creation.
- Unit-test that state, assignee, and comments are not modified.

# Risks and mitigations
- Risk: Task-file sub-task formats may vary.
  - Mitigation: Support the current documented format first and fail clearly on ambiguous structures.
- Risk: Search may return multiple candidate issues.
  - Mitigation: Require exact task ID matching before treating an issue as existing.
- Risk: Partial failures can occur after some creates or updates.
  - Mitigation: Return mutation progress and enough identifiers for retry.

# Follow-ups
- Add branch guidance generation in `TASK-0015`.
- Consider relation reconciliation/removal only after create/update sync is stable.
