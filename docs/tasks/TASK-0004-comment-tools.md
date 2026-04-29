id: TASK-0004
status: todo
summary: Implement Linear issue comment create and list tools

# Goal
Let Pi agents read issue discussion context and add comments or threaded replies.

# Problem
The MVP needs comment operations for collaboration, handoffs, and progress updates without exposing full comment management risk.

# Dependencies
- `TASK-0001` for package registration.
- `TASK-0002` for client setup, validation, normalization, pagination, and issue resolution.
- `TASK-0003` for issue resolver integration patterns.

# Scope
In scope:
- Implement `linear_create_comment`.
- Implement `linear_list_comments`.
- Replace the placeholder handlers for these tools.
- Support threaded replies through `parentId`.
- Return concise `content` plus structured `details`.

Out of scope:
- Editing comments.
- Deleting comments.
- Resolving comments.
- Comment reactions.
- Archived or deleted comment handling.
- Nested thread trees.

# Functional Requirements
## Create Comment
- Require `issueId` as a UUID or human issue identifier.
- Resolve `issueId` through the shared issue resolver before creating the comment.
- Require non-empty, non-whitespace Markdown `body`.
- Accept optional `parentId` for threaded replies.
- Return the created normalized comment including body and URL when available.
- Include associated issue summary when available.

## List Comments
- Require `issueId` as a UUID or human issue identifier.
- Resolve `issueId` through the shared issue resolver.
- Accept optional `first` and `after`.
- Use default page size `25`, maximum `100`, and reject above max.
- Return comments in flat chronological order, oldest first.
- Include `parentId` references rather than nesting replies.
- Return comment bodies because the primary use case is discussion context.

# Acceptance Criteria
- [ ] Agents can add a comment to an issue by UUID or human identifier.
- [ ] Agents can add a threaded reply with `parentId`.
- [ ] Agents can list comments for an issue with bounded pagination.
- [ ] Listed comments are flat and oldest-first.
- [ ] Tool output follows the PRD `content` and `details` contract.

# Testing Expectations
- Unit-test comment creation with mocked SDK mutation results.
- Unit-test rejection of empty and whitespace-only comment bodies.
- Unit-test issue identifier resolution before comment creation and listing.
- Unit-test comment listing pagination bounds and oldest-first ordering inputs.
- Unit-test normalized comment output includes body, URL, parent ID, issue summary, author summary, and timestamps where available.

# Risks And Mitigations
- Risk: SDK comment listing may require using either issue connections or client-level filters.
  - Mitigation: Encapsulate comment listing behind one helper and verify the chosen path with a sandbox workspace during QA.
- Risk: Threaded reply support may have SDK-specific field naming.
  - Mitigation: Keep `parentId` mapping isolated and covered by tests.

# Follow-Ups
- Add discovery tools in `TASK-0005`.
