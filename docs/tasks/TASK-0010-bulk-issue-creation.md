id: TASK-0010
status: done
summary: Add bulk Linear issue creation

# Goal
Let agents create many related Linear issues in one tool call.

# Problem
Creating dozens of sub-tasks with repeated `linear_create_issue` calls is slow, noisy, and error-prone. Agents need a bulk creation path that preserves the existing single-issue validation and output contract.

# Dependencies
- `TASK-0003` for the existing `linear_create_issue` payload mapping and validation.
- `TASK-0007` for optional parent issue support.

# Scope
In scope:
- Add a new `linear_create_issues` tool.
- Accept one required `teamId` shared by all created issues.
- Accept an array of issue inputs with optional metadata and `parentId`.
- Return every created issue with UUID, identifier, title, URL, and parent summary when available.
- Fail safely with clear errors when validation fails.

Out of scope:
- Idempotency or duplicate detection.
- Updating existing issues.
- Dependency creation between issues.
- Transactional rollback after partial Linear API success unless the SDK provides native support.

# Functional requirements
## Input
```ts
linear_create_issues({
  teamId: string,
  issues: Array<{
    title: string
    description?: string
    parentId?: string
    priority?: string
    labelIds?: string[]
    stateId?: string
    assigneeId?: string
  }>
})
```

- `teamId` must be non-empty.
- `issues` must be a non-empty array.
- Each issue must pass the same title, description, priority, label, state, and assignee validation used by `linear_create_issue`.
- `parentId` must accept UUIDs and human-readable issue identifiers using the existing resolver.

## Creation behavior
- Validate all inputs before creating the first issue where practical.
- Create issues sequentially unless safe SDK-supported concurrency is already established.
- Preserve input order in the returned `issues` array.
- If a later create fails, return/throw enough context to identify which issue failed.

## Output
```ts
{
  issues: Array<{
    id: string
    identifier: string
    title: string
    url?: string
    parent?: { id: string; identifier: string }
  }>
}
```

- Visible content must include each created issue identifier and title.

# Acceptance criteria
- [x] Agents can create multiple issues with one tool call.
- [x] Agents can create multiple sub-issues under the same parent.
- [x] Validation failures prevent avoidable partial creation.
- [x] Returned issue order matches input issue order.
- [x] Output includes stable UUIDs for all created issues.
- [x] Existing `linear_create_issue` behavior remains unchanged.

# Testing expectations
- Unit-test bulk creation of two or more issues.
- Unit-test parent resolution for issues with `parentId`.
- Unit-test validation rejects empty issue arrays and invalid issue items before mutation.
- Unit-test partial failure error context.
- Unit-test visible and structured output include all created issue identifiers and IDs.

# Risks and mitigations
- Risk: Without Linear transactions, a failure can leave some issues created.
  - Mitigation: Validate eagerly, create sequentially, and include partial failure context for recovery.
- Risk: Bulk input could create too much noise or hit API limits.
  - Mitigation: Add a conservative maximum batch size if needed during implementation.

# Follow-ups
- Add dependency linking in `TASK-0012`.
- Add idempotent duplicate avoidance in `TASK-0014`.
