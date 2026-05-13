id: TASK-0009
status: done
summary: Add Linear issue search by title or task ID

# Goal
Let agents check for existing Linear issues before creating duplicates.

# Problem
`linear_list_issues` only lists recent open issues with limited filters. Agents need to search by a task ID such as `TASK-0067` or by title text before creating parent issues and sub-issues.

# Dependencies
- `TASK-0002` for client setup, validation, pagination helpers, and issue normalization.
- `TASK-0003` for the existing issue listing patterns.

# Scope
In scope:
- Add a new `linear_search_issues` tool.
- Support query text, optional `teamId`, optional `includeArchived`, and bounded `first`.
- Return compact issue summaries with IDs needed for follow-up operations.
- Include parent issue summary when Linear returns parent data.

Out of scope:
- Full text search ranking controls.
- Project, cycle, label, assignee, or state filters beyond `teamId`.
- Updating or creating issues as part of search.

# Functional requirements
## Input
```ts
linear_search_issues({
  query: string,
  teamId?: string,
  includeArchived?: boolean,
  first?: number
})
```

- `query` must be a non-empty string after trimming.
- `first` defaults to `25`, is capped at `100`, and rejects invalid values.
- `includeArchived` defaults to `false`.

## Output
```ts
{
  issues: Array<{
    id: string
    identifier: string
    title: string
    url?: string
    state?: { id: string; name: string }
    parent?: { id: string; identifier: string }
  }>
}
```

- Visible content must include identifiers and titles for matched issues.
- Structured output must include UUIDs for follow-up reads, updates, relations, and sub-issue creation.

# Acceptance criteria
- [x] Agents can search by task ID text and see matching issue identifiers.
- [x] Agents can limit search to a team.
- [x] Archived issues are excluded by default and included when requested.
- [x] Search results include stable issue UUIDs and parent identifiers when available.
- [x] Existing `linear_list_issues` behavior remains unchanged.

# Testing expectations
- Unit-test required query validation.
- Unit-test default and maximum `first` validation.
- Unit-test filter construction for `teamId` and `includeArchived`.
- Unit-test normalized search results include `id`, `identifier`, `title`, `url`, `state`, and `parent` when present.
- Unit-test visible content includes result identifiers and titles.

# Risks and mitigations
- Risk: Linear SDK search support may differ from list filtering.
  - Mitigation: Isolate query construction in the tool and test against mocked SDK calls.
- Risk: Parent data may be lazy-loaded by the SDK.
  - Mitigation: Normalize parent only when available, and document omitted parent fields clearly.

# Follow-ups
- Reuse search in `TASK-0014` for idempotent task-file sync.
