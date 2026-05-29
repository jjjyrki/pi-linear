id: TASK-0025
status: todo
summary: Add selective batch helpers for common low-complexity Linear operations

# Goal
Let agents perform a small set of common Linear operations in batches to reduce request overhead and rate-limit pressure without introducing full mixed-operation batching.

# Problem
The extension has strong single-item tools and bulk issue creation, but common repeated actions such as moving many issues to a state, assigning many issues, or linking many dependencies still require one call per item. Full general-purpose batching would add significant implementation and error-handling complexity. We need a narrow batch layer that covers the easiest, safest, highest-value cases.

# Dependencies
- `TASK-0010` for bulk issue creation patterns and validation.
- `TASK-0012` for issue relation payload mapping.
- `TASK-0020` for workflow-state transition semantics if reused.

# Scope
In scope:
- Add batch support only for these operation families:
  - create many issues
  - update many issues with one shared patch
  - assign or unassign many issues
  - move many issues to one workflow state
  - create many issue relations
- Keep existing single-item tools unchanged.
- Reuse existing validators, ID resolvers, and output formatting where practical.
- Return per-item results in input order with enough context to recover from partial failures.
- Document conservative limits for batch sizes.

Out of scope:
- Arbitrary mixed-operation batches in one request.
- Batch comments.
- Batch delete operations.
- Batch parent/sub-issue hierarchy creation beyond existing helpers.
- Transactional rollback across partially successful mutations unless Linear natively supports it.
- Broad new abstractions that rewrite the current Linear tool architecture.

# Functional requirements
## 1) Batch create issues
- Support creating multiple issues in one tool call using the existing `linear_create_issues` surface.
- Where practical, allow a more efficient internal implementation that uses Linear batch capabilities instead of one mutation per item.
- Preserve current validation and output behavior.

## 2) Batch update issues with a shared patch
Add a focused tool such as:

```ts
linear_update_issues({
  issueIds: string[],
  changes: {
    title?: string
    description?: string
    stateId?: string
    assigneeId?: string | null
    priority?: string
    labelIds?: string[]
    projectId?: string | null
    cycleId?: string | null
    estimate?: number | null
    dueDate?: string | null
    parentId?: string | null
  }
})
```

- `issueIds` must be a non-empty array.
- All issues receive the same `changes` payload.
- Validate the shared patch with the same rules used by `linear_update_issue`.
- Reject empty `changes` objects.

## 3) Batch assign or unassign issues
Add a focused helper such as:

```ts
linear_assign_issues({
  issueIds: string[],
  assigneeId?: string | null
})
```

- This may be implemented as a thin specialization of batch update.
- Output must clearly show the resulting assignee target.

## 4) Batch move issues to one workflow state
Add a focused helper such as:

```ts
linear_transition_issues({
  issueIds: string[],
  stateId: string
})
```

- First version may require exact `stateId` only.
- If semantic workflow targets are supported, they must follow the same safe ambiguity rules as the single-issue transition helper.
- Output must clearly show the target state.

## 5) Batch create issue relations
Add a tool such as:

```ts
linear_create_issue_relations({
  relations: Array<{
    issueId: string
    relatedIssueId: string
    type: string
  }>
})
```

- Each relation is independent.
- Reuse the same relation-type validation as `linear_create_issue_relation`.
- Preserve input order in results.

## 6) Error handling and limits
- Validate all inputs before executing mutations where practical.
- Define a conservative maximum batch size per tool.
- If a batch partially succeeds, return or throw structured context that identifies which items succeeded and which failed.
- Do not hide partial success behind a single generic error message.

## 7) Documentation and prompt metadata
- Document the new tools, intended use cases, and limitations.
- Update agent-facing prompt metadata so agents prefer these batch helpers for independent repeated work.

# Acceptance criteria
- [ ] Bulk issue creation remains available and is documented as the preferred path for creating many issues.
- [ ] Agents can update many issues with one shared patch.
- [ ] Agents can assign or unassign many issues with one tool call.
- [ ] Agents can move many issues to one workflow state with one tool call.
- [ ] Agents can create many issue relations with one tool call.
- [ ] Each batch tool validates inputs and fails safely on avoidable errors.
- [ ] Each batch tool returns per-item result context in a predictable order.
- [ ] Existing single-item tools remain unchanged.
- [ ] Existing tests and build still pass.

# Testing expectations
- Unit-test successful batch update, batch assign, batch transition, and batch relation creation.
- Unit-test validation for empty arrays, invalid IDs, invalid relation types, and empty shared update patches.
- Unit-test partial failure reporting for each new batch tool.
- Unit-test output formatting and result ordering.
- Run `npm run ci`.

# Risks and mitigations
- Risk: Partial success can leave the system in a mixed state.
  - Mitigation: Validate eagerly, keep batches limited to independent operations, and return structured per-item outcomes.
- Risk: Large batches may still hit Linear complexity or request limits.
  - Mitigation: Use conservative batch caps and document that batching reduces request count but does not remove complexity limits.
- Risk: Batch-specific tools could duplicate too much single-item logic.
  - Mitigation: Reuse existing validators, resolvers, and response mappers instead of forking behavior.

# Follow-ups
- Consider per-item custom update payloads only if shared-patch batching proves insufficient.
- Consider semantic bulk workflow transitions once single-issue semantic transitions are stable.
- Consider limited retry/backoff behavior for recoverable API failures if real-world usage needs it.
