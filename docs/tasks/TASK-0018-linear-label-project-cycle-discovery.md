id: TASK-0018
status: todo
summary: Add Linear label, project, and cycle discovery tools

# Goal
Let agents discover common Linear relationship IDs needed to create and update well-classified issues.

# Problem
Issue create/update accepts IDs such as `labelIds`, but agents cannot currently discover labels, projects, or cycles through the extension. This makes agentic issue creation dependent on users manually providing IDs.

# Scope
In scope:
- Add `linear_list_labels` with optional team filter, query, pagination, and normalized label output.
- Add `linear_list_projects` with optional team filter, query/status filter, pagination, and normalized project output.
- Add `linear_list_cycles` with optional team filter, pagination, and normalized cycle output.
- Add optional `projectId` and `cycleId` support to issue create/update if the Linear SDK supports those fields cleanly.
- Update `/linear-tools`, README, and tests.

Out of scope:
- Creating labels, projects, or cycles.
- Project documents, milestones, initiatives, or roadmaps.
- Ambiguous name-to-ID mutation shortcuts.

# Functional requirements
## 1) Label discovery
Agents can list or search labels and obtain IDs usable in `labelIds`.

## 2) Project discovery
Agents can list or search projects and obtain IDs usable when creating or updating issues.

## 3) Cycle discovery
Agents can list cycles for a team and obtain IDs usable when creating or updating issues.

## 4) Normalized output
Discovery results must return compact structured objects and pagination metadata.

# Acceptance criteria
- [ ] Agents can discover label IDs through `linear_list_labels`.
- [ ] Agents can discover project IDs through `linear_list_projects`.
- [ ] Agents can discover cycle IDs through `linear_list_cycles`.
- [ ] Issue create/update supports project and cycle IDs if confirmed against the SDK.
- [ ] New tools are registered and listed by `/linear-tools`.
- [ ] README documents discovery-before-mutation usage.
- [ ] Existing tests and build still pass.

# Testing expectations
- Unit-test schema validation, pagination bounds, normalization, and SDK call shapes for each discovery tool.
- Unit-test issue create/update payload mapping for `projectId` and `cycleId` if added.
- Run `npm run ci`.
- Verify against a Linear sandbox when credentials are available.

# Risks and mitigations
- Risk: Linear SDK relation field names may differ from expected `projectId`/`cycleId` inputs.
  - Mitigation: Confirm against SDK types and sandbox before exposing schema fields.

# Follow-ups
- Add name-resolution helpers only if ambiguity can be handled safely.
