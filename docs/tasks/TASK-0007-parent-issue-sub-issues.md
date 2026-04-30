id: TASK-0007
status: todo
summary: Support creating and updating Linear issues with parentId sub-issues

# Goal
Let Pi agents create issues as sub-issues and reparent existing issues.

# Problem
The current issue tools do not support parent/child issue relationships, which limits decomposition of larger Linear work items into actionable sub-issues.

# Dependencies
- `TASK-0002` for client setup, validation, normalization, and issue resolution.
- `TASK-0003` for the existing create/update issue tool paths.

# Scope
In scope:
- Add optional `parentId` support to `linear_create_issue`.
- Add optional `parentId` support to `linear_update_issue`.
- Resolve parent issue references through the shared issue resolver before mutation.
- Support both UUIDs and human-readable issue identifiers for `parentId`.
- Preserve existing create/update behavior when no parent is provided.
- Return the same compact issue summary shape already used by issue tools.

Out of scope:
- Comment thread parent IDs.
- Listing issue children or traversing issue trees.
- Bulk reparenting.
- Automatic parent discovery from issue content.

# Functional requirements
## Create Issue
- Accept an optional `parentId`.
- Resolve the parent before creating the issue.
- Create the issue as a sub-issue when a parent is supplied.
- Keep all existing create fields and validation unchanged.

## Update Issue
- Accept an optional `parentId` for reparenting.
- Resolve the parent before updating the issue.
- Allow clearing the parent only if the Linear SDK exposes a supported clearing path.
- Preserve existing update validation and no-op protection.

# Acceptance criteria
- [ ] Agents can create a Linear issue under an existing parent issue.
- [ ] Agents can reparent an existing issue to a different parent.
- [ ] Parent issue references accept UUIDs and human issue identifiers.
- [ ] Existing issue creation and update behavior remains unchanged when no parent is provided.
- [ ] Tool output stays on the existing `content` and `details` contract.

# Testing expectations
- Unit-test parent resolution for create and update paths.
- Unit-test creating an issue with a parent issue reference.
- Unit-test updating an issue to set a new parent.
- Unit-test clearing the parent only if the SDK supports it.
- Unit-test that omitted parent input preserves current behavior.

# Risks and mitigations
- Risk: The Linear SDK may use a different field name or clearing semantics for parent issues than expected.
  - Mitigation: Isolate the parent mapping behind a small helper and cover it with focused tests.
- Risk: Reparenting may have workspace-specific constraints.
  - Mitigation: Validate the SDK behavior against a sandbox workspace before broadening scope.

# Follow-ups
- Consider adding child issue listing or hierarchy display only after parent support is stable.
- Update any tool or prompt docs that mention the issue tool input shape.
