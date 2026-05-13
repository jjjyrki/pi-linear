id: TASK-0015
status: todo
summary: Add markdown task sub-issue creation with branch guidance

# Goal
Generate Linear sub-issues from markdown task files with standard branch and PR guidance included in each sub-issue description.

# Problem
Task decomposition often includes branch ordering and stacking guidance. Agents currently write this guidance manually, which is repetitive and easy to make inconsistent.

# Dependencies
- `TASK-0010` for bulk issue creation.
- `TASK-0013` for task-file parsing and idempotent sync behavior.

# Scope
In scope:
- Add a helper that reads a markdown task file and creates sub-issues from `# Implementation sub-tasks`.
- Generate deterministic branch names using a provided branch prefix.
- Include standardized branch order / PR guidance when requested.
- Preserve the task-file dependency order in generated guidance.

Out of scope:
- Creating git branches.
- Opening pull requests.
- Enforcing branch protections.
- Inferring dependencies from unrelated prose.
- Replacing the full sync tool; this helper should complement it.

# Functional requirements
## Input
```ts
linear_create_task_subissues_from_markdown({
  teamId: string,
  taskFilePath: string,
  branchPrefix: string,
  includeBranchGuidance: true
})
```

- `teamId` must be non-empty.
- `taskFilePath` must point to a readable markdown file.
- `branchPrefix` must be non-empty and safe to use as part of a branch name.
- `includeBranchGuidance` controls whether branch guidance is appended to generated descriptions.

## Branch guidance
When `includeBranchGuidance` is true, each created sub-issue description should include a section like:

```md
Branch order / PR guidance:
- Preferred branch: `task-0067-12-create-webhook-to-job-enqueue-path`
- Base branch: latest `main` after TASK-0067.8 and TASK-0067.11 are merged.
- Stack only if absolutely necessary.
```

- Preferred branch names must be deterministic and slugified.
- Base branch guidance must reflect parsed dependencies when available.
- If no dependencies are present, base branch guidance should use latest `main`.
- Guidance must not require stacked PRs unless dependencies make that unavoidable.

## Output
```ts
{
  subissues: Array<{
    key: string
    preferredBranch: string
    baseBranchGuidance: string
    issue: {
      id: string
      identifier: string
      title: string
      url?: string
    }
  }>
}
```

- Visible content must include created issue identifiers and preferred branch names.

# Acceptance criteria
- [ ] Agents can create sub-issues from a markdown task file with generated branch guidance.
- [ ] Generated branch names are deterministic and safe.
- [ ] Dependency-aware base branch guidance is included when dependencies are parsed.
- [ ] Guidance defaults to latest `main` when no dependencies exist.
- [ ] Output includes issue UUIDs, identifiers, and preferred branches.

# Testing expectations
- Unit-test branch slug generation.
- Unit-test guidance generation with and without dependencies.
- Unit-test markdown sub-task parsing integration using representative task files.
- Unit-test created descriptions include the guidance section only when requested.
- Unit-test visible and structured output include preferred branch names.

# Risks and mitigations
- Risk: Branch naming conventions may change by repository.
  - Mitigation: Keep `branchPrefix` explicit and branch generation deterministic.
- Risk: Dependency parsing may be ambiguous.
  - Mitigation: Use only the `# Implementation sub-tasks` parser supported by `TASK-0013` and fail clearly on unsupported formats.

# Follow-ups
- Consider moving branch guidance into `linear_sync_task_file` only after both workflows are proven useful.
