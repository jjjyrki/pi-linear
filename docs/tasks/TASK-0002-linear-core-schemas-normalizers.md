id: TASK-0002
status: todo
summary: Implement shared Linear client, schemas, validation, normalizers, and issue resolution

# Goal
Build the shared foundation used by all Linear tools.

# Problem
The tool handlers need consistent authentication, validation, pagination limits, priority mapping, output normalization, and issue UUID/identifier resolution.

# Scope
In scope:
- Implement lazy `LinearClient` creation from `LINEAR_API_KEY`.
- Add shared errors that produce concise, non-secret messages.
- Add input schemas and validation helpers for shared field types.
- Add priority enum mapping between friendly values and Linear numeric priority.
- Add pagination validation with default `25`, maximum `100`, and rejection above max.
- Add due date validation for `YYYY-MM-DD`.
- Add normalizers for issue summaries, comments, users, teams, workflow states, and page info.
- Add a shared issue resolver that accepts UUIDs or human identifiers such as `ENG-123` and resolves to a Linear issue UUID.

Out of scope:
- Registering final tool behavior.
- Implementing issue/comment/discovery tool handlers beyond helpers needed for tests.
- Slash command behavior.

# Functional Requirements
## Authentication
- Create the SDK client lazily from `LINEAR_API_KEY`.
- Missing credentials must fail with a clear action item.
- Token values must never appear in errors, tool content, details, or logs.
- Do not support `LINEAR_ACCESS_TOKEN` or alternate token environment variables.

## Validation
- Validate titles as non-empty and non-whitespace.
- Allow `description: ""` only for update flows that intentionally clear a description.
- Reject whitespace-only descriptions and comment bodies.
- Validate date-only `dueDate` strings as `YYYY-MM-DD`.
- Reject pagination `first` values above `100`.

## Normalization
- Normalize SDK models to stable agent-facing JSON instead of exposing SDK objects.
- Use friendly priority output: `no_priority`, `urgent`, `high`, `medium`, or `low`.
- Omit email from routine issue assignee and comment author summaries.
- Include email in viewer and user discovery normalizers when available.

## Issue Resolution
- Resolve issue UUIDs directly when possible.
- Resolve human issue identifiers to UUIDs before mutations and comment operations.
- Return clear not-found errors.

# Acceptance Criteria
- [ ] Shared client creation works with `LINEAR_API_KEY` and fails cleanly without it.
- [ ] Shared validators cover title, description, comments, due dates, priorities, and pagination.
- [ ] Normalizers return the fields specified in the PRD output contract.
- [ ] Issue resolver supports UUID and human identifier inputs.
- [ ] No helper exposes Linear tokens.

# Testing Expectations
- Unit-test missing and present auth configuration with mocked environment variables.
- Unit-test validation helpers and edge cases.
- Unit-test priority input/output mapping.
- Unit-test normalizers with mocked SDK-like objects.
- Unit-test issue resolution success and not-found paths with a mocked client.

# Risks And Mitigations
- Risk: Linear SDK model properties may be async or connection-backed.
  - Mitigation: Model normalizers around the SDK patterns found in docs/examples and isolate SDK access behind small helpers.
- Risk: Identifier resolution may need a specific SDK query shape.
  - Mitigation: Keep resolver behavior covered by mocks and verify against a sandbox workspace during QA.

# Follow-Ups
- Use these helpers in issue tools in `TASK-0003`.
