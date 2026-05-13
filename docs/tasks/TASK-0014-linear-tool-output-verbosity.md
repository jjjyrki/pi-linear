id: TASK-0014
status: done
summary: Standardize Linear tool output with actionable objects

# Goal
Make Linear tool responses consistently useful for follow-up agent operations and final reporting.

# Problem
Some tools return concise summary text that omits stable IDs or related metadata. Agents need UUIDs, identifiers, URLs, parent references, team names, and state names without making extra read calls or bypassing the extension.

# Dependencies
- `TASK-0003` for issue tools.
- `TASK-0004` for comment tools.
- `TASK-0005` for discovery tools.
- `TASK-0007` for parent issue support.

# Scope
In scope:
- Audit all Linear tools for visible `content` and structured `details` output.
- Ensure create, read, update, list, search, bulk, relation, and discovery tools return actionable objects.
- Add parent, team, and state summaries to normalized issue outputs where available.
- Keep visible content concise while including the most important identifiers.
- Preserve existing tool names and input schemas.

Out of scope:
- New Linear mutations.
- Full issue descriptions in compact list/search outputs unless already required.
- Breaking changes to existing input parameters.
- Changing Linear SDK client setup.

# Functional requirements
## Issue object output
For create, update, read, list, search, and bulk issue outputs, include where available:
- `id`
- `identifier`
- `title`
- `url`
- `parent`: `{ id: string; identifier: string; title?: string }`
- `team`: `{ id: string; key?: string; name?: string }`
- `state`: `{ id: string; name: string; type?: string }`

## Discovery output
- Team, user, and workflow state discovery tools must return arrays of objects with IDs in structured output.
- Visible content should include enough IDs and names to select an item without inspecting hidden details.

## Mutation output
- Create and update tools must return the mutated object, not only status text.
- Bulk tools must return every mutated object in input order.
- Relation tools must return relation ID, relation type, and both issue summaries.

## Compatibility
- Keep the existing `content` plus `details` contract.
- Prefer additive fields over renaming or removing existing fields.
- Keep visible text short enough for agent logs.

# Acceptance criteria
- [x] Every Linear tool returns stable UUIDs in structured output for the primary objects it reads or mutates.
- [x] Issue outputs include identifier, title, URL, parent identifier, team key/name, and state name when available.
- [x] Visible content for list/discovery tools includes usable IDs, not only counts.
- [x] Existing consumers of current `details` fields remain compatible or receive a documented migration note.
- [x] Tests cover the standardized output for each affected tool family.

# Testing expectations
- Unit-test normalized issue summaries include parent, team, and state metadata when available.
- Unit-test create/read/update/list visible output includes actionable identifiers.
- Unit-test discovery visible output includes object IDs.
- Unit-test bulk and relation output shapes once those tools exist.
- Regression-test that descriptions remain omitted from compact list/search outputs unless explicitly requested.

# Risks and mitigations
- Risk: Additive output changes may expose larger responses than desired.
  - Mitigation: Keep descriptions out of compact outputs and cap visible content summaries.
- Risk: Some SDK relationships may be lazy-loaded promises.
  - Mitigation: Normalize only available data unless a tool explicitly needs to load the relation.

# Follow-ups
- Document the final output contract in package docs after implementation stabilizes.
