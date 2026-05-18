id: TASK-0020
status: todo
summary: Add safe workflow-state transition helpers for agent progress updates

# Goal
Let agents move issues through Linear workflows without requiring users to manually provide state IDs every time.

# Problem
`linear_update_issue` can set `stateId`, but agents must discover and choose exact state IDs. Common workflows such as start work, block work, mark ready for review, or complete work need safer higher-level helpers.

# Scope
In scope:
- Add a tool such as `linear_transition_issue` that accepts `issueId` and either an explicit `stateId` or a constrained semantic target.
- Support team-scoped workflow-state lookup before mutation.
- Require unambiguous matches for semantic targets; otherwise return candidates and do not mutate.
- Include optional progress comment text in the same operation only if implemented safely and documented.
- Update docs and prompt metadata.

Out of scope:
- Custom team-specific workflow configuration files.
- Automatic status transitions based on GitHub/CI state.
- Bulk transitions.

# Functional requirements
## 1) Explicit transitions
Agents can transition an issue by exact `stateId` using a focused tool.

## 2) Semantic transitions
Agents can request common targets such as `started`, `blocked`, `ready_for_review`, `done`, or `canceled` when they resolve to exactly one team state.

## 3) Ambiguity handling
If no state or multiple states match, the tool must return candidates and avoid mutation.

# Acceptance criteria
- [ ] `linear_transition_issue` is registered and documented.
- [ ] Exact state ID transitions work.
- [ ] Semantic transitions either update exactly one state or fail safely with candidates.
- [ ] Tool output includes the updated issue summary.
- [ ] Existing update behavior remains unchanged.
- [ ] Existing tests and build still pass.

# Testing expectations
- Unit-test exact ID transition payloads.
- Unit-test semantic lookup success, no-match, and ambiguous-match cases.
- Unit-test optional progress comment behavior if included.
- Run `npm run ci`.

# Risks and mitigations
- Risk: Semantic state names vary significantly across teams.
  - Mitigation: Treat semantic mapping as best-effort and require unambiguous matches before mutation.

# Follow-ups
- Add project-local workflow aliases if repeated manual mapping becomes painful.
