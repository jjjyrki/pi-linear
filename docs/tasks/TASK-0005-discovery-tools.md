id: TASK-0005
status: done
summary: Implement Linear viewer, team, user, and workflow state discovery tools

# Goal
Give agents the IDs they need while keeping mutation inputs deterministic and ID-only.

# Problem
The MVP requires IDs for teams, users, and workflow states, but users naturally refer to names, team keys, and statuses. Discovery tools let agents resolve those references without hidden write-time lookup.

# Dependencies
- `TASK-0001` for package registration.
- `TASK-0002` for client setup, pagination validation, normalizers, and output shape.

# Scope
In scope:
- Implement `linear_viewer`.
- Implement `linear_list_teams`.
- Implement `linear_list_users`.
- Implement `linear_list_workflow_states`.
- Replace the placeholder handlers for these tools.
- Return concise `content` plus structured `details`.

Out of scope:
- Label discovery.
- Project discovery.
- Cycle discovery.
- Team-scoped workflow state filtering.
- Name resolution inside mutation tools.

# Functional Requirements
## Viewer
- Return the authenticated Linear user with `id`, `displayName`, `name`, and `email` where available.
- Use the SDK viewer/current-user API.
- Keep visible output short.

## Teams
- Return team `id`, `key`, and `name`.
- Accept optional `first` and `after`.
- Use default page size `25`, maximum `100`, and reject above max.
- Do not expose a text query in the MVP.

## Users
- Return user `id`, `displayName`, `name`, and `email` where available.
- Accept optional `query`, `first`, and `after`.
- Allow no-query listing as a paginated fallback.
- Use default page size `25`, maximum `100`, and reject above max.

## Workflow States
- Return workflow states in one bounded response, capped at 1000 states for the MVP.
- Include `id`, `name`, `type`, and team summary where available.
- Include `truncated: true` when more workflow states may be available beyond the cap.
- Do not expose `teamId` filtering in the MVP.

# Acceptance Criteria
- [x] Agents can discover the authenticated viewer.
- [x] Agents can discover team IDs.
- [x] Agents can discover user IDs with optional text filtering.
- [x] Agents can discover workflow state IDs.
- [x] Discovery tool `content` stays short while `details` includes structured data.
- [x] Tool output follows the PRD `content` and `details` contract.

# Testing Expectations
- Unit-test each discovery tool with a mocked `LinearClient`.
- Unit-test pagination defaults and max rejection for teams and users.
- Unit-test optional user query handling.
- Unit-test normalized output fields for viewer, teams, users, and workflow states.

# Risks And Mitigations
- Risk: User query support may not map directly to the SDK list API.
  - Mitigation: Isolate query construction and verify against SDK docs/examples before implementation.
- Risk: Workflow state list size could grow in multi-team workspaces.
  - Mitigation: Keep team-scoped filtering as documented future work.

# Follow-Ups
- Add slash commands and final QA in `TASK-0006`.
