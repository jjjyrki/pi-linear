id: TASK-0021
status: todo
summary: Add idempotency and duplicate-prevention safeguards for agent mutations

# Goal
Reduce accidental duplicate issues, comments, and relations during agent retries or repeated prompts.

# Problem
Agentic workflows may retry operations, re-run plans, or lose context. Existing task-file sync is idempotent, but lower-level create/comment/relation tools can still duplicate work when called repeatedly.

# Scope
In scope:
- Add optional idempotency keys or client-provided external references where Linear supports them or where safe search-before-create can emulate them.
- Add duplicate-prevention guidance and helper behavior for issue creation based on title/task key/team.
- Add duplicate-prevention behavior for dependency relations where existing relations can be detected safely.
- Add optional dry-run or preview mode for high-risk bulk mutations.
- Document retry-safe agent patterns.

Out of scope:
- Persistent local database cache.
- Global deduplication across unrelated teams or workspaces.
- Automatic deletion/cleanup of suspected duplicates.

# Functional requirements
## 1) Issue duplicate checks
Agents can check for existing likely matches before creating new issues.

## 2) Relation duplicate checks
Creating an existing relation should not create noise or fail unexpectedly when avoidable.

## 3) Bulk preview
Bulk or sync operations expose a preview/dry-run path before writing.

# Acceptance criteria
- [ ] Documented agent workflow recommends search/sync before create.
- [ ] Issue create helpers support an optional safe duplicate check or explicit rationale for not doing so.
- [ ] Relation creation is idempotent or clearly reports an existing relation when SDK support allows.
- [ ] Bulk mutations support dry-run or preview where practical.
- [ ] Existing tests and build still pass.

# Testing expectations
- Unit-test duplicate-detection branches for issue creation helpers.
- Unit-test relation existing/no-op behavior if implemented.
- Unit-test dry-run output for bulk mutation flows.
- Run `npm run ci`.

# Risks and mitigations
- Risk: Fuzzy duplicate detection may suppress legitimate new issues.
  - Mitigation: Require exact or high-confidence keys by default; return candidates instead of silently skipping ambiguous creates.

# Follow-ups
- Explore Linear-native external IDs if the SDK/API supports them.
