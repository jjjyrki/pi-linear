id: TASK-0003
status: todo
summary: Implement Linear issue create, read, list, update, and assign tools

# Goal
Expose the MVP issue workflow to Pi agents through focused tools.

# Problem
Agents need reliable Linear issue CRUD operations without direct SDK knowledge, raw GraphQL, or ambiguous relationship lookup behavior.

# Dependencies
- `TASK-0001` for package registration.
- `TASK-0002` for client setup, schemas, validation, normalization, pagination, priority mapping, and issue resolution.

# Scope
In scope:
- Implement `linear_create_issue`.
- Implement `linear_read_issue`.
- Implement `linear_list_issues`.
- Implement `linear_update_issue`.
- Implement `linear_assign_issue`.
- Replace the placeholder handlers for these tools.
- Return concise `content` plus structured `details`.

Out of scope:
- Comment tools.
- Discovery tools beyond consuming IDs supplied by callers.
- Project and cycle support.
- Label append/remove operations.
- Public `orderBy`, `includeArchived`, or `statusGroup` filters.

# Functional Requirements
## Create Issue
- Require `teamId` and non-whitespace `title`.
- Accept optional `description`, `assigneeId`, `stateId`, `priority`, `labelIds`, `estimate`, and `dueDate`.
- Treat `description` as raw Markdown.
- Convert friendly priority values internally.
- Return a compact normalized issue summary.

## Read Issue
- Accept a Linear UUID or human issue identifier.
- Resolve through the shared issue resolver.
- Return the full normalized issue shape including description.

## List Issues
- Accept optional `teamId`, `assigneeId`, `stateId`, `first`, and `after`.
- Default to open, non-archived issues where workflow state type is not `completed` or `canceled`.
- Return most recently updated issues first.
- Use default page size `25`, maximum `100`, and reject above max.
- Return compact summaries without descriptions.

## Update Issue
- Accept a Linear UUID or human issue identifier.
- Require at least one mutable field.
- Support `title`, `description`, `stateId`, `assigneeId`, `priority`, `labelIds`, `estimate`, and `dueDate`.
- Reject empty or whitespace-only titles.
- Allow `description: ""` to clear the description.
- Use `labelIds` as a full replacement field; `[]` removes all labels.
- Allow `null` only for fields with clear Linear clearing semantics.
- Return a compact normalized issue summary.

## Assign Issue
- Accept a Linear UUID or human issue identifier.
- Accept optional `assigneeId`; omitted or `null` unassigns the issue.
- Reuse the issue update path internally.
- Return a compact normalized issue summary.

# Acceptance Criteria
- [ ] Agents can create an issue with required inputs and optional metadata.
- [ ] Agents can read an issue by UUID or human identifier.
- [ ] Agents can list open non-archived issues with bounded pagination and stable ordering.
- [ ] Agents can update supported fields and cannot submit no-op updates.
- [ ] Agents can assign and unassign through the dedicated tool.
- [ ] Tool output follows the PRD `content` and `details` contract.

# Testing Expectations
- Unit-test each issue tool with a mocked `LinearClient`.
- Unit-test validation failures for required fields and unsupported no-op updates.
- Unit-test issue identifier resolution is used before reads, updates, assignment, and relevant mutations.
- Unit-test list filtering, updated-first ordering inputs, and page-size bounds.
- Unit-test compact summaries omit descriptions while read includes description.

# Risks And Mitigations
- Risk: Linear SDK filtering for open issues may be more verbose than expected.
  - Mitigation: Keep filter construction isolated and covered by tests.
- Risk: Some fields may not support clearing with `null`.
  - Mitigation: Keep nullable support conservative and adjust based on SDK behavior.

# Follow-Ups
- Add issue comment tools in `TASK-0004`.
