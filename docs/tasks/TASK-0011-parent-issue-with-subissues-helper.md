id: TASK-0011
status: todo
summary: Add parent issue with sub-issues creation helper

# Goal
Support the common task-file workflow of creating one parent Linear issue and multiple sub-issues in one tool call.

# Problem
Agents often need to turn a task spec into a parent issue plus actionable sub-issues. Doing this with separate create calls is slow and requires manually carrying the parent issue ID between calls.

# Dependencies
- `TASK-0007` for parent issue support on create.
- `TASK-0010` for shared bulk creation validation and output patterns.

# Scope
In scope:
- Add a new `linear_create_issue_with_subissues` tool.
- Create a parent issue first, then create each sub-issue under that parent.
- Return the created parent and every created sub-issue with stable IDs.
- Preserve input order for returned sub-issues.

Out of scope:
- Parsing markdown task files.
- Idempotency or duplicate detection.
- Dependency relationships between sub-issues.
- Branch guidance generation.
- Transactional rollback after partial Linear API success unless the SDK provides native support.

# Functional requirements
## Input
```ts
linear_create_issue_with_subissues({
  teamId: string,
  parent: {
    title: string
    description?: string
  },
  subissues: Array<{
    title: string
    description?: string
  }>
})
```

- `teamId` must be non-empty.
- `parent.title` and every `subissues[].title` must be non-empty.
- `subissues` must be a non-empty array.
- Descriptions are raw Markdown and follow the same validation as `linear_create_issue`.

## Creation behavior
- Validate the complete input before creating the parent where practical.
- Create the parent first.
- Create sub-issues with `parentId` set to the created parent issue ID.
- Create sub-issues sequentially unless safe SDK-supported concurrency is already established.
- If a sub-issue create fails, surface which sub-issue failed and include created issue context when available.

## Output
```ts
{
  parent: {
    id: string
    identifier: string
    title: string
    url?: string
  },
  subissues: Array<{
    id: string
    identifier: string
    title: string
    url?: string
  }>
}
```

- Visible content must include the parent identifier and all sub-issue identifiers.

# Acceptance criteria
- [ ] Agents can create a parent issue and multiple sub-issues in one call.
- [ ] Every created sub-issue is parented to the created parent issue.
- [ ] Returned sub-issue order matches input order.
- [ ] Output includes stable UUIDs and identifiers for parent and sub-issues.
- [ ] Existing single and bulk create tools remain unchanged.

# Testing expectations
- Unit-test successful parent plus sub-issue creation.
- Unit-test validation rejects missing parent title and empty sub-issue arrays before mutation.
- Unit-test sub-issue payloads use the created parent ID.
- Unit-test partial failure context for failed sub-issue creation.
- Unit-test visible and structured output include parent and sub-issue IDs.

# Risks and mitigations
- Risk: Without transactions, a sub-issue failure can leave the parent and earlier sub-issues created.
  - Mitigation: Validate eagerly, create sequentially, and return enough context for cleanup or retry.

# Follow-ups
- Use this helper from task-file sync in `TASK-0013` when creating a missing parent and all missing sub-issues.
