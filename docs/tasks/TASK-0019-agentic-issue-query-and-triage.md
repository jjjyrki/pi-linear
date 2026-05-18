id: TASK-0019
status: todo
summary: Add agentic issue query, triage, and "my work" workflows

# Goal
Give agents reliable ways to find actionable Linear work before reading or mutating issues.

# Problem
Agents can list open issues and search by text, but common agent workflows need richer filters such as assigned-to-me, unassigned, label, project, cycle, priority, status type, recently updated, and stale issues.

# Scope
In scope:
- Extend `linear_list_issues` or add a dedicated query tool with additional safe filters.
- Support viewer-relative filtering such as `assignedToViewer` after resolving `linear_viewer`.
- Support filters for unassigned, label IDs, project ID, cycle ID, priority, state type, created/updated date ranges, and include archived/completed toggles where SDK support is clear.
- Preserve bounded pagination and normalized summaries.
- Document common triage prompts.

Out of scope:
- Saved Linear views.
- Natural-language query parsing inside the tool.
- Automatic mutation of triaged issues.

# Functional requirements
## 1) Rich filtering
Agents can fetch focused issue lists without over-broad workspace scans.

## 2) Viewer-relative workflows
Agents can answer prompts such as "show my open Linear work" without requiring the user to know their Linear user ID.

## 3) Triage-ready output
Issue summaries include enough metadata for prioritization without full descriptions.

# Acceptance criteria
- [ ] Agents can list issues assigned to the authenticated viewer.
- [ ] Agents can list unassigned issues for a team.
- [ ] Agents can filter by labels, project, cycle, priority, state type, and date bounds where supported.
- [ ] Filters are validated and documented.
- [ ] Pagination remains bounded and predictable.
- [ ] Existing tests and build still pass.

# Testing expectations
- Unit-test filter construction for each supported query option.
- Unit-test invalid filter combinations and pagination bounds.
- Run `npm run ci`.
- Manually verify at least one viewer-relative query against a sandbox when credentials are available.

# Risks and mitigations
- Risk: A large filter schema can confuse agents.
  - Mitigation: Keep names explicit and include prompt metadata with common examples.

# Follow-ups
- Add optional saved-view support if the Linear SDK exposes it cleanly.
