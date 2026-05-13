id: TASK-0008
status: done
summary: Make team discovery return usable team IDs

# Goal
Make `linear_list_teams` output immediately usable for follow-up Linear tool calls.

# Problem
Agents need a team UUID for `linear_create_issue`, but the visible `linear_list_teams` response can be only a count such as `Found 1 teams`. That forces bypassing the extension or guessing IDs.

# Dependencies
- `TASK-0005` for the existing discovery tool implementation.

# Scope
In scope:
- Ensure `linear_list_teams` returns a structured `teams` array with `id`, `key`, and `name`.
- Make the visible tool output include usable team identifiers, not only a count.
- Preserve existing pagination inputs: `first` and `after`.
- Preserve existing page info in structured output.

Out of scope:
- Team name/key lookup inside mutation tools.
- Label, project, or cycle discovery.
- Changing the Linear SDK client setup.

# Functional requirements
## Output shape
- Return:
  ```ts
  {
    teams: Array<{
      id: string
      key: string
      name: string
    }>
    pageInfo?: {
      endCursor?: string | null
      hasNextPage: boolean
      hasPreviousPage: boolean
      startCursor?: string | null
    }
  }
  ```
- Include every returned team's UUID in the visible tool content.
- Omit or clearly mark missing optional SDK fields without hiding the team UUID.

## Pagination
- Keep default page size `25`, maximum `100`, and existing validation.
- Return pagination metadata so callers can fetch additional pages.

# Acceptance criteria
- [x] `linear_list_teams` visibly exposes team UUIDs, keys, and names.
- [x] `linear_list_teams` structured output includes `teams[].id` for every returned team.
- [x] Existing pagination behavior remains unchanged.
- [x] Agents can copy `teams[0].id` directly into `linear_create_issue.teamId`.

# Testing expectations
- Unit-test normalized team output includes `id`, `key`, and `name`.
- Unit-test visible content includes team IDs instead of only a count.
- Unit-test pagination defaults and maximum validation still pass.

# Risks and mitigations
- Risk: Some Linear team objects may omit `key` or `name` in mocks or SDK edge cases.
  - Mitigation: Require `id`, preserve best-effort optional fields, and cover missing-field behavior in tests.

# Follow-ups
- Apply the broader output contract to all Linear tools in `TASK-0014`.
