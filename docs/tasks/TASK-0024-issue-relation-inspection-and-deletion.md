id: TASK-0024
status: done
summary: Add Linear issue relation listing and safe deletion by relation ID

# Goal
Let agents inspect existing Linear issue relationships and remove the wrong one safely.

# Problem
The extension can create issue relations but cannot list or delete them. That makes it hard to recover from an incorrect dependency without leaving Pi or guessing at relation direction.

# Dependencies
- `TASK-0012` for existing relation creation and public relation vocabulary.
- `TASK-0002` for issue resolution helpers.

# Scope
In scope:
- Add `linear_list_issue_relations` for one issue.
- Add `linear_delete_issue_relation` using `relationId`.
- Include enough relation detail to identify direction, type, and counterpart issue.
- Keep public relation type vocabulary aligned with existing relation tools.
- Update docs/help text for the new tools.

Out of scope:
- Deletion by `issueId` + `relatedIssueId` fallback shape.
- Bulk relation deletion.
- Automatic duplicate detection or cleanup.

# Functional requirements
## 1) List issue relations
```ts
linear_list_issue_relations({
  issueId: string
})
```

- Accept a UUID or human-readable issue identifier.
- Return both outgoing and incoming relationships for the issue.
- Normalize blocking direction so agents can read `blocks`, `blocked_by`, or `related` from the requested issue's perspective.

## 2) Delete issue relation
```ts
linear_delete_issue_relation({
  relationId: string
})
```

- Reject blank relation IDs before calling Linear.
- Delete the specific relation by ID.
- Return a confirmation payload with the deleted relation ID.

# Acceptance criteria
- [x] Agents can list existing relations for an issue.
- [x] List output makes relation direction clear from the requested issue's perspective.
- [x] Agents can delete an existing relation by relation ID.
- [x] Validation rejects blank `issueId` and `relationId` inputs.
- [x] `/linear-tools` includes both new tools.
- [x] Tests cover list normalization, delete success, and failure paths.

# Testing expectations
- Unit-test relation normalization for outgoing and incoming blocking/related relations.
- Unit-test issue resolution and relation listing output.
- Unit-test delete validation and SDK delete call wiring.
- Run `npm run ci`.

# Risks and mitigations
- Risk: Linear stores relation direction differently than the public tool vocabulary.
  - Mitigation: Normalize from the requested issue's perspective and cover both outgoing and incoming cases with tests.
- Risk: Operators may delete the wrong relation if output lacks counterpart issue context.
  - Mitigation: Include counterpart issue identifier/title and the relation ID in list output.

# Follow-ups
- Add optional deletion by `(issueId, relatedIssueId, type)` only if relation IDs prove too cumbersome in practice.
