id: TASK-0017
status: todo
summary: Add agent-oriented prompt metadata to all Linear tools

# Goal
Make Linear tools easier and safer for agents to choose during natural-language workflows.

# Problem
Tools currently have names, labels, descriptions, and schemas, but lack richer prompt guidance such as when to use each tool, required discovery steps, and safety boundaries.

# Scope
In scope:
- Add `promptSnippet` and `promptGuidelines` metadata to every registered Linear tool if supported by Pi.
- Describe common agentic flows: discover IDs, read issue context, create/update issues, post progress comments, and sync task files.
- Add guardrails for destructive or broad updates, duplicate creation, and ambiguous names.
- Keep metadata concise enough to avoid bloating tool context.

Out of scope:
- Changing tool behavior or schemas.
- Adding new Linear API operations.
- Custom rendering.

# Functional requirements
## 1) Tool selection guidance
Each tool must explain when an agent should use it and when it should prefer another tool.

## 2) Safety guidance
Write tools must warn agents to resolve ambiguous IDs before mutating Linear data and to avoid duplicate issue creation when search/sync is more appropriate.

## 3) Workflow guidance
Task-file, bulk-create, relation, and subissue tools must include guidance for planning/decomposition workflows.

# Acceptance criteria
- [ ] Every Linear tool has prompt metadata where Pi supports it.
- [ ] Metadata distinguishes discovery, read, mutation, bulk, and sync workflows.
- [ ] Mutation tools include concise safety guidance.
- [ ] Tests or snapshots verify that all registered tools include required metadata fields.
- [ ] Existing tests and build still pass.

# Testing expectations
- Run `npm run ci`.
- Add a unit test that iterates over `linearToolDefinitions` and checks metadata completeness.
- Manually inspect tool context in Pi if possible.

# Risks and mitigations
- Risk: Excess metadata may crowd out useful conversation context.
  - Mitigation: Keep guidance short and specific; avoid repeating full schemas.

# Follow-ups
- Add example prompt templates for common Linear workflows after metadata proves useful.
