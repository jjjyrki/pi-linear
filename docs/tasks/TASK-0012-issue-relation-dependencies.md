id: TASK-0012
status: done
summary: Add Linear issue relation and dependency creation

# Goal
Let agents represent dependencies between Linear issues using native Linear relationships.

# Problem
Dependency information is currently encoded in issue descriptions. Native Linear relations make blockers visible in Linear and easier for agents to inspect and maintain.

# Dependencies
- `TASK-0002` for issue resolution helpers.
- `TASK-0003` for existing issue mutation patterns.

# Scope
In scope:
- Add a new `linear_create_issue_relation` tool.
- Support relation types `blocks`, `blocked_by`, and `related`.
- Resolve both issue inputs from UUIDs or human-readable identifiers.
- Return the created relation and normalized issue summaries where available.

Out of scope:
- Bulk dependency creation.
- Automatic dependency parsing from markdown.
- Removing relations.
- Listing relations.
- Cycle detection beyond Linear API validation.

# Functional requirements
## Input
```ts
linear_create_issue_relation({
  issueId: string,
  relatedIssueId: string,
  type: "blocks" | "blocked_by" | "related"
})
```

- `issueId` and `relatedIssueId` must be non-empty.
- Both issue references must accept UUIDs and human-readable issue identifiers.
- `type` must be one of `blocks`, `blocked_by`, or `related`.

## Relation mapping
- `blocks`: create a relation where `issueId` blocks `relatedIssueId`.
- `blocked_by`: create a relation where `issueId` is blocked by `relatedIssueId`.
- `related`: create a non-blocking related issue relation.
- Keep the public relation vocabulary stable even if the Linear SDK uses different internal names.

## Output
```ts
{
  relation: {
    id: string
    type: "blocks" | "blocked_by" | "related"
  },
  issue: {
    id: string
    identifier: string
    title: string
  },
  relatedIssue: {
    id: string
    identifier: string
    title: string
  }
}
```

- Visible content must state the created relationship using issue identifiers.

# Acceptance criteria
- [x] Agents can create a blocking relationship between two issues.
- [x] Agents can create a related issue relationship between two issues.
- [x] Issue references accept UUIDs and human-readable identifiers.
- [x] Output includes stable relation and issue IDs.
- [x] Invalid relation types are rejected before mutation.

# Testing expectations
- Unit-test relation type validation.
- Unit-test issue resolution for both issue references.
- Unit-test SDK payload mapping for `blocks`, `blocked_by`, and `related`.
- Unit-test visible and structured output for created relations.
- Unit-test Linear API failure messages preserve enough context to recover.

# Risks and mitigations
- Risk: Linear SDK relation names or directionality may differ from the public tool API.
  - Mitigation: Isolate relation type mapping and cover all directions with focused tests.
- Risk: Duplicate relations may be rejected or no-op depending on Linear behavior.
  - Mitigation: Surface Linear's response clearly and leave idempotent relation sync to `TASK-0013`.

# Follow-ups
- Add bulk relation creation only if repeated relation calls remain too noisy.
- Use this tool from task-file sync in `TASK-0013`.
