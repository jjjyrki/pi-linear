# PRD: Pi Linear Extension

## Status
Draft

## Intent
Build a Pi extension that gives agents a small, reliable tool surface for working with Linear issues and issue comments through the official `@linear/sdk`.

The extension should let an agent create, read, list, update, and assign Linear issues, plus read and add issue comments, without asking the agent to hand-write GraphQL, shell out to ad hoc scripts, or manage Linear authentication details directly.

## Background
Pi extensions are TypeScript modules that can register custom tools via `pi.registerTool()`. Linear provides an official TypeScript SDK through `@linear/sdk`, including `LinearClient`, typed models, pagination, and issue mutations such as `createIssue(...)` and update operations.

This extension should be packaged as a Pi package so it can be installed locally, from git, or from npm. It should keep the first release intentionally narrow: issue and issue comment operations, minimal ID discovery, API-key authentication only, and no interactive Linear setup flow.

In Pi there are two different user-facing surfaces:
- Agent tools registered with `pi.registerTool(...)`. The model calls these automatically when the user asks it to work with Linear.
- Slash commands registered with `pi.registerCommand(...)`. The human user runs these directly in the Pi prompt, usually for setup, status, help, or shortcuts.

The core Linear issue and comment operations should be tools, not slash commands, because agents need to call them during normal task execution. Slash commands should make the package easier to discover and operate inside Pi without duplicating every tool.

## Goals
- Expose the basic Linear issue workflow to Pi agents.
- Let agents read issue discussion context and add progress or handoff comments.
- Use the official Linear SDK rather than direct GraphQL calls for the MVP.
- Return concise, structured issue data that is easy for models to use.
- Keep authentication explicit and local through environment variables.
- Make failures actionable without leaking secrets.

## Non-goals
- Full Linear API coverage.
- OAuth setup or browser-based login flow.
- Webhook handling, agent sessions, attachments, projects, cycles, documents, or reactions.
- Updating, deleting, resolving, or reacting to comments.
- Long-lived caching or background syncing.
- Replacing Linear as a source of truth with local state.

## Users
- A Pi user who wants agents to file and maintain Linear issues during coding sessions.
- An agent that needs to turn TODOs, bugs, and implementation notes into Linear work items.
- A team that wants a reviewable package exposing a controlled subset of Linear operations.

## Proposed Tool Surface

These are Pi agent tools. They should appear in the model's available tool list through clear `description`, `promptSnippet`, and `promptGuidelines` metadata so the agent understands when to call them.

The MVP exposes eleven tools: seven issue/comment tools and four discovery tools. Writes should remain ID-only except for issue references, where user-facing issue identifiers such as `ENG-123` are accepted and resolved internally to UUIDs. Parent issue relationships use `parentId`.

### `linear_create_issue`
Create a Linear issue.

Required parameters:
- `teamId`: Linear team ID.
- `title`: Issue title.

Optional parameters:
- `description`
- `assigneeId`
- `stateId`
- `priority`: `no_priority`, `urgent`, `high`, `medium`, or `low`.
- `labelIds`
- `estimate`
- `dueDate`
- `parentId` (optional sub-issue parent)

Returns:
- `id`
- `identifier`
- `title`
- `url`
- `state`
- `assignee`
- `team`
- `priority`
- `labels`
- `estimate`
- `dueDate`
- `createdAt`
- `updatedAt`

Implementation:
- Call `linearClient.createIssue(input)`.
- Read the returned issue model from the mutation payload before returning.
- Throw if the mutation reports failure or no issue is returned.
- Validate that `title` is non-empty and not whitespace-only.
- Treat `description` as raw Linear Markdown and pass it through unchanged except for string validation.
- Reject whitespace-only descriptions. Empty string is only meaningful for updates that intentionally clear a description.
- Convert friendly priority values to Linear's numeric priority internally.
- Support optional `parentId` to create the issue as a sub-issue.

### `linear_read_issue`
Read a single Linear issue.

Required parameters:
- `issueId`: Linear issue UUID or human issue identifier such as `ENG-123`.

Returns:
- Core issue fields.
- Description.
- State, team, assignee, labels, priority, estimate, due date, timestamps, and URL where available.

Implementation:
- Use a shared internal resolver that accepts either a UUID or an issue identifier and returns the Linear issue UUID plus a compact issue summary.
- Normalize the response to a compact JSON object rather than returning the full SDK model.
- Always include the full issue description.

### `linear_list_issues`
List open Linear issues with pagination and common filters.

Optional parameters:
- `teamId`
- `assigneeId`
- `stateId`
- `first`
- `after`

Returns:
- `nodes`: compact issue summaries.
- `pageInfo`: `hasNextPage`, `endCursor`, `hasPreviousPage`, `startCursor`.

Implementation:
- Call `linearClient.issues(...)`.
- Default to open, non-archived issues. Open means the workflow state type is not `completed` and not `canceled`.
- Order results by most recently updated first. Do not expose `orderBy` in the MVP.
- Use `first` default `25`, maximum `100`, and reject requests above the maximum with a clear validation error.
- Return summaries only; detailed issue descriptions should be fetched with `linear_read_issue`.

### `linear_update_issue`
Update mutable issue fields.

Required parameters:
- `issueId`

Optional parameters:
- `title`
- `description`
- `stateId`
- `assigneeId`
- `priority`: `no_priority`, `urgent`, `high`, `medium`, or `low`.
- `labelIds`
- `estimate`
- `dueDate`
- `parentId`

Returns:
- Updated compact issue object.

Implementation:
- Resolve the issue through the shared UUID/identifier resolver.
- Prefer `issue.update(input)` after reading the issue, or use the client-level update mutation if it is simpler and typed.
- Reject calls with no mutable fields.
- Reject empty or whitespace-only `title`.
- Allow `description: ""` to intentionally clear the description. Reject whitespace-only descriptions.
- Use `labelIds` as a full replacement field. Use `[]` to remove all labels; do not add append/remove label operations in the MVP.
- Use date-only `YYYY-MM-DD` strings for `dueDate`.
- Allow `null` only for fields with clear Linear clearing semantics, such as assignment, estimate, due date, or parent issue. Keep the exact nullable set conservative during implementation.

### `linear_assign_issue`
Assign or unassign an issue.

Required parameters:
- `issueId`

Optional parameters:
- `assigneeId`: When omitted or null, unassign the issue.

Returns:
- Updated compact issue object.

Implementation:
- Use the same underlying update path as `linear_update_issue` with `assigneeId`.
- Keep this as a separate tool because assignment is a frequent agent action and deserves a simple prompt-facing contract.

### `linear_create_comment`
Add a comment to a Linear issue.

Required parameters:
- `issueId`: Linear issue UUID or human issue identifier, resolved through the shared issue resolver.
- `body`: Markdown comment body.

Optional parameters:
- `parentId`: Parent comment ID when replying in a comment thread.

Returns:
- Created normalized comment object, including the body.
- Associated issue summary where available.

Implementation:
- Resolve the issue through the shared UUID/identifier resolver.
- Call `linearClient.createComment({ issueId, body, parentId })`.
- Read the returned comment model from the mutation payload before returning.
- Reject empty or whitespace-only comment bodies.

### `linear_list_comments`
List comments for a Linear issue.

Required parameters:
- `issueId`: Linear issue UUID or human issue identifier, resolved through the shared issue resolver.

Optional parameters:
- `first`
- `after`

Returns:
- `nodes`: normalized comments in flat chronological order, oldest first.
- `pageInfo`: `hasNextPage`, `endCursor`, `hasPreviousPage`, `startCursor`.

Implementation:
- Prefer the issue model's comments connection if available after resolving the issue.
- Alternatively call `linearClient.comments({ filter: { issue: { id: { eq: issueId } } }, ...pagination })`.
- Use `first` default `25`, maximum `100`, and reject requests above the maximum with a clear validation error.
- Return comment bodies because the primary use case is giving agents discussion context.
- Return comments as a flat list with `parentId` references rather than nesting replies.

### `linear_viewer`
Return the authenticated Linear user.

Parameters:
- None.

Returns:
- `viewer`: `id`, `displayName`, `name`, and `email` where available.

Implementation:
- Use the SDK viewer/current-user API.
- Keep the visible summary short while returning structured details for agent use.

### `linear_list_teams`
List Linear teams so agents can discover team IDs.

Optional parameters:
- `first`
- `after`

Returns:
- `teams`: `id`, `key`, and `name`.
- `pageInfo`: `hasNextPage`, `endCursor`, `hasPreviousPage`, `startCursor`.

Implementation:
- Use `first` default `25`, maximum `100`, and reject requests above the maximum with a clear validation error.
- Do not expose a team text query in the MVP.

### `linear_list_users`
List Linear users so agents can discover assignee IDs.

Optional parameters:
- `query`: Text search for resolving a user by name or email.
- `first`
- `after`

Returns:
- `users`: `id`, `displayName`, `name`, and `email` where available.
- `pageInfo`: `hasNextPage`, `endCursor`, `hasPreviousPage`, `startCursor`.

Implementation:
- Use `first` default `25`, maximum `100`, and reject requests above the maximum with a clear validation error.
- Allow no-query listing as a paginated fallback.

### `linear_list_workflow_states`
List workflow states so agents can discover state IDs.

Parameters:
- None for the MVP.

Returns:
- `workflowStates`: `id`, `name`, `type`, and team summary where available.
- `truncated`: `true` when the bounded response cap is reached before all states are returned.

Implementation:
- Return workflow states in one bounded response, capped at 1000 states for the MVP.
- Set `truncated: true` when more workflow states may be available beyond the cap.
- Do not add team-scoped state filtering in the MVP because the expected workspace uses one team.

### `linear_list_labels`
List issue labels so agents can discover label IDs.

Optional parameters:
- `teamId`: Scope labels to a team.
- `query`: Case-insensitive name search.
- `first`
- `after`

Returns:
- `labels`: `id`, `name`, `color`, `description`, `isGroup`, and team summary where available.
- `pageInfo`: `hasNextPage`, `endCursor`, `hasPreviousPage`, `startCursor`.

Implementation:
- Use `first` default `25`, maximum `100`, and reject requests above the maximum with a clear validation error.
- Call the SDK `issueLabels` query with optional team and name filters.

### `linear_list_projects`
List projects so agents can discover project IDs.

Optional parameters:
- `teamId`: Limit to projects accessible to a team.
- `query`: Case-insensitive name search.
- `statusId`: Filter by project status ID.
- `first`
- `after`

Returns:
- `projects`: `id`, `name`, `slugId`, `url`, `description`, `color`, deprecated `state`, and `status` summary where available.
- `pageInfo`: `hasNextPage`, `endCursor`, `hasPreviousPage`, `startCursor`.

Implementation:
- Use `first` default `25`, maximum `100`, and reject requests above the maximum with a clear validation error.
- Exclude trashed projects by default.

### `linear_list_cycles`
List cycles so agents can discover cycle IDs.

Optional parameters:
- `teamId`: Scope cycles to a team.
- `first`
- `after`

Returns:
- `cycles`: `id`, `number`, `name`, `description`, `startsAt`, `endsAt`, phase flags, and team summary where available.
- `pageInfo`: `hasNextPage`, `endCursor`, `hasPreviousPage`, `startCursor`.

Implementation:
- Use `first` default `25`, maximum `100`, and reject requests above the maximum with a clear validation error.
- Order cycles by `createdAt`.

### Discovery before mutation
Agents should list or search for IDs before setting relationship fields on create or update:
- `labelIds` via `linear_list_labels`
- `projectId` via `linear_list_projects`
- `cycleId` via `linear_list_cycles`
- `stateId` via `linear_list_workflow_states`
- `assigneeId` via `linear_list_users`
- `teamId` via `linear_list_teams`

## Proposed Pi Slash Commands

Slash commands are for the human using Pi. They should be lightweight wrappers around package status and documentation, not the primary issue API.

### `/linear`
Show a short help card for the extension.

Expected output:
- Whether Linear credentials are configured.
- The available agent tools.
- Example prompts the user can type.
- A reminder that issue and comment operations are performed by the agent through tools.

Example:

```text
/linear
```

### `/linear-status`
Validate local Linear configuration.

Expected output:
- Whether `LINEAR_API_KEY` is present, without printing the value.
- Optional SDK connectivity check if the implementation can do this safely with a low-cost read operation.
- Clear next step when credentials are missing.

Example:

```text
/linear-status
```

### `/linear-tools`
List the registered Linear tools and their required inputs.

Expected output:
- `linear_create_issue`: requires `teamId`, `title`.
- `linear_read_issue`: requires `issueId`.
- `linear_list_issues`: optional filters and pagination.
- `linear_update_issue`: requires `issueId` plus at least one mutable field.
- `linear_assign_issue`: requires `issueId`; optional `assigneeId`.
- `linear_create_comment`: requires `issueId`, `body`; optional `parentId`.
- `linear_list_comments`: requires `issueId`; optional pagination.
- `linear_viewer`: no inputs.
- `linear_list_teams`: optional pagination.
- `linear_list_users`: optional `query` and pagination.
- `linear_list_workflow_states`: no inputs.
- `linear_list_labels`: optional `teamId`, `query`, and pagination.
- `linear_list_projects`: optional `teamId`, `query`, `statusId`, and pagination.
- `linear_list_cycles`: optional `teamId` and pagination.

Example:

```text
/linear-tools
```

### Command trade-off
The MVP should not add slash commands such as `/linear-create` or `/linear-update`. Those commands would duplicate the tool schemas, make validation harder to keep consistent, and encourage users to type structured IDs manually. Natural-language prompts should drive issue operations, while slash commands support setup and discovery.

## Using The Extension In Pi

### Install from a local checkout during development

Run Pi with the extension path for quick testing:

```bash
pi -e ./src/index.ts
```

For project-local development, use the package entrypoint declared in `package.json`, then reload Pi resources:

```text
/reload
```

For a packaged local install:

```bash
pi install ./path/to/pi-linear
```

Use `-l` when the package should be recorded in the current project's `.pi/settings.json` instead of the global Pi settings:

```bash
pi install -l ./path/to/pi-linear
```

### Configure authentication

Set this environment variable before starting Pi:

```bash
export LINEAR_API_KEY="lin_api_..."
```

Then start Pi from the same shell and run:

```text
/linear-status
```

The command should confirm whether `LINEAR_API_KEY` is present without printing token contents.

### Ask the agent to use Linear

Users should interact with Linear through normal Pi prompts. The agent decides when to call the registered Linear tools.

Examples:

```text
Create a Linear issue in team ENG titled "Fix flaky checkout test" and include the failure summary from this session.
```

```text
Read ENG-123 and summarize its current state, assignee, and description.
```

```text
List my open issues in Linear for team ENG.
```

```text
Update ENG-123 with the implementation notes from this PRD.
```

```text
Assign ENG-123 to Sarah if you can determine her Linear user ID from the provided context.
```

```text
Add a comment to ENG-123 summarizing the fix and linking to the current PR.
```

```text
List the comments on ENG-123 and summarize any open questions.
```

### Expected Pi behavior

When the extension is active:
- The agent sees the Linear tools in its tool context.
- The user can run `/linear`, `/linear-status`, and `/linear-tools` directly.
- Tool calls return concise text for the model and structured `details` for rendering/debugging.
- Missing credentials fail with a clear action item instead of a stack trace.
- `/reload` refreshes project-local extension changes during development.

## Authentication
The extension should create a `LinearClient` lazily from `LINEAR_API_KEY`.

If `LINEAR_API_KEY` is missing, tools should throw a clear error explaining which variable to set. The MVP should not support alternate token environment variables.

Tokens must never be included in:
- Tool result `content`.
- Tool result `details`.
- Error messages.
- Logs or custom renderers.

## Package Shape
Proposed structure:

```text
package.json
src/
  index.ts
  client.ts
  commands.ts
  tools/
    createIssue.ts
    readIssue.ts
    listIssues.ts
    updateIssue.ts
    assignIssue.ts
    createComment.ts
    listComments.ts
    viewer.ts
    listTeams.ts
    listUsers.ts
    listWorkflowStates.ts
  linear/
    normalizeIssue.ts
    normalizeComment.ts
    normalizeDiscovery.ts
    resolveIssue.ts
  schemas.ts
  errors.ts
test/
  linear-extension.test.ts
```

`package.json` should:
- Include `@linear/sdk` in `dependencies`.
- Include Pi packages such as `@mariozechner/pi-coding-agent`, `@mariozechner/pi-ai`, `@mariozechner/pi-tui`, and `typebox` as peer dependencies if imported.
- Declare the Pi extension entry through the `pi.extensions` manifest, using `./src/index.ts`.
- Use `"type": "module"`.

Example manifest fragment:

```json
{
  "pi": {
    "extensions": ["./src/index.ts"]
  }
}
```

`src/index.ts` should default-export the Pi extension factory and register all tools and slash commands.

## Tool Schema Guidelines
- Use `Type.Object(...)` schemas for all tool inputs.
- Use strict, intention-revealing field names.
- Use SDK-compatible IDs directly for non-issue relationships in the MVP.
- Keep optional fields optional rather than inventing broad nested update payloads.
- Use string enums via Pi-compatible enum helpers where enum constraints are needed.
- Accept human issue identifiers such as `ENG-123` for issue-specific tools, but resolve them internally to Linear UUIDs before mutations.
- Keep non-issue relationship inputs ID-only. Use discovery tools to find team, user, and workflow state IDs.
- Use friendly priority enum values in schemas: `no_priority`, `urgent`, `high`, `medium`, and `low`.
- Use `YYYY-MM-DD` date-only strings for `dueDate`.

## Output Contract
Every tool should return:

```ts
{
  content: [{ type: "text", text: "<short human-readable summary>" }],
  details: {
    issue?: NormalizedIssue,
    issues?: NormalizedIssueSummary[],
    comment?: NormalizedComment,
    comments?: NormalizedComment[],
    viewer?: NormalizedUser,
    teams?: NormalizedTeam[],
    users?: NormalizedUser[],
    workflowStates?: NormalizedWorkflowState[],
    pageInfo?: PageInfo,
  }
}
```

The visible `content` should be short, such as "Found 12 users" or "Updated ENG-123". Structured `details` should carry the data agents need for follow-up tool calls.

Normalized issue summaries should avoid returning the entire SDK model. They should include lightweight metadata but not descriptions:

```ts
{
  id: string;
  identifier: string;
  title: string;
  url?: string;
  state?: { id: string; name: string; type?: string };
  assignee?: { id: string; displayName?: string; name?: string };
  team?: { id: string; key?: string; name?: string };
  priority?: {
    value: "no_priority" | "urgent" | "high" | "medium" | "low";
    label: string;
  };
  labels?: { id: string; name: string; color?: string }[];
  estimate?: number | null;
  dueDate?: string | null;
  createdAt?: string;
  updatedAt?: string;
}
```

`linear_read_issue` should return the same fields plus the full `description`.

Normalized comments should include enough body and author context for agents without returning the full SDK model:

```ts
{
  id: string;
  body: string;
  url?: string;
  parentId?: string;
  issue?: { id: string; identifier?: string; title?: string };
  user?: { id: string; displayName?: string; name?: string };
  createdAt?: string;
  updatedAt?: string;
  editedAt?: string;
}
```

Normalized discovery objects:

```ts
type NormalizedUser = {
  id: string;
  displayName?: string;
  name?: string;
  email?: string;
};

type NormalizedTeam = {
  id: string;
  key?: string;
  name?: string;
};

type NormalizedWorkflowState = {
  id: string;
  name: string;
  type?: string;
  team?: NormalizedTeam;
};
```

Routine issue assignee and comment author summaries should omit email. `linear_list_users` and `linear_viewer` may include email because those tools exist for identity discovery.

## Error Handling
- Throw from tool execution for failed Linear operations so Pi marks the tool result as an error.
- Convert SDK errors into concise messages with operation context.
- Preserve enough detail for debugging, such as missing required Linear IDs or permission failures.
- Do not swallow rate limit, authentication, or permission errors.
- Avoid retrying mutations automatically in the MVP to prevent duplicate issue creation.

## Rendering
Custom rendering is optional for the MVP.

If added, keep it compact:
- Tool call: show operation and issue identifier/title if known.
- Tool result: show success summary and URL for created issues or comments when available.
- Expanded result: show compact JSON details.

Slash commands should use `ctx.ui.notify(...)` or a compact custom message. They should not require a custom TUI component in the MVP.

## Acceptance Criteria
- Agents can create a Linear issue with team ID and title.
- Agents can read a Linear issue by UUID or human identifier and receive normalized structured details including description.
- Agents can list open, non-archived issues with pagination metadata, compact summaries, and most-recently-updated-first ordering.
- Agents can update supported issue fields.
- Agents can assign and unassign issues through a dedicated tool.
- Agents can add comments to issues.
- Agents can add threaded replies through `parentId`.
- Agents can list issue comments with pagination metadata, flat `parentId` references, and oldest-first ordering.
- Agents can discover the authenticated Linear viewer.
- Agents can discover team IDs.
- Agents can discover user IDs, optionally filtered by text query.
- Agents can discover workflow state IDs.
- Missing authentication produces a clear, non-secret error.
- Tool results never expose Linear tokens.
- List output is bounded by a documented maximum page size.
- The package can be loaded by Pi as an extension.
- The extension documents the difference between Pi agent tools and Pi slash commands.
- The user can run `/linear` to discover available commands, tools, and example prompts.
- The user can run `/linear-status` to verify authentication setup without exposing secrets.
- The user can run `/linear-tools` to inspect the Linear tool surface from inside Pi.

## Testing Expectations
- Unit-test schema validation for required and optional parameters.
- Unit-test `LINEAR_API_KEY` authentication setup and missing-token errors.
- Unit-test each tool with a mocked `LinearClient`.
- Unit-test normalization so SDK models become stable agent-facing JSON.
- Unit-test issue UUID/identifier resolution through the shared resolver.
- Unit-test priority enum mapping in both input and output normalization.
- Unit-test title, description, comment body, due date, and pagination validation.
- Unit-test that `linear_update_issue` rejects empty updates.
- Unit-test `linear_assign_issue` maps to the update path correctly.
- Unit-test `linear_create_comment` rejects empty bodies and returns normalized comment details.
- Unit-test `linear_list_issues` applies open/non-archived filtering, fixed updated-first ordering, and page-size bounds.
- Unit-test `linear_list_comments` applies issue filtering, fixed oldest-first ordering, flat `parentId` output, and page-size bounds.
- Unit-test discovery tools for viewer, teams, users, and workflow states.
- Unit-test slash command handlers with mocked Pi command contexts where practical.
- Add one smoke test or documented manual test using a real Linear sandbox workspace if credentials are available.

## Trade-offs

### Official SDK vs direct GraphQL
Using `@linear/sdk` reduces implementation risk, gives typed operations, and follows Linear's documented path. The downside is that the extension inherits SDK model shape and generated API changes. Direct GraphQL could return exactly shaped payloads, but it would add query maintenance and duplicate SDK functionality.

Decision: use `@linear/sdk` for the MVP.

### Separate tools vs one generic `linear_issue` tool
Separate tools make agent intent clearer and reduce accidental broad updates. A single action-based tool would reduce code repetition, but it creates a larger schema and makes model errors harder to detect.

Decision: expose eleven focused tools: seven issue/comment tools plus `linear_viewer`, `linear_list_teams`, `linear_list_users`, and `linear_list_workflow_states`.

### Token auth only vs OAuth
API keys are straightforward for local agent use. OAuth would improve multi-user distribution but adds setup UX, token storage, refresh behavior, and security review.

Decision: support `LINEAR_API_KEY` only for the MVP; revisit OAuth after the tool surface proves useful.

### Separate assignment tool vs update-only assignment
Assignment is technically an issue update. A dedicated `linear_assign_issue` tool duplicates a thin layer of behavior but gives agents a safer, obvious path for a frequent action.

Decision: keep a dedicated assignment tool backed by the update implementation.

### Comment create/list vs full comment management
Creating and listing comments covers the main agent collaboration loop: understand prior discussion, then post concise progress, handoff, or completion notes. Updating and deleting comments are riskier because agents could rewrite or remove human discussion history, and reactions/resolution behavior adds product-specific semantics.

Decision: include `linear_create_comment` and `linear_list_comments` in the MVP. Keep comment update/delete/reaction operations out of scope.

### Name lookup vs ID-only inputs
Accepting human names, team keys, and state names would be friendlier, but name resolution can be ambiguous. ID-only relationship inputs are less convenient but deterministic, and the MVP includes discovery tools so agents can find the IDs they need.

Decision: MVP uses IDs for non-issue relationships. Issue-specific tools accept UUIDs or human issue identifiers such as `ENG-123`, resolved internally to UUIDs.

### Webhooks vs agent-initiated tools
Webhook ingestion is useful in the broader Linear workflow, but it belongs in a separate component. This package should stay focused on Pi commands and agent-initiated tools.

Decision: webhook handling is out of scope for this package.

## Open Questions
- Whether to add project, cycle, and label discovery after the initial tool surface is implemented.
- Whether to expose team-scoped workflow state filtering if the workspace expands beyond one Linear team.
- Whether to add an explicit `active` issue filter once the team workflow semantics are clearer.

## Future Work
- Add discovery tools for labels, projects, and cycles.
- Add team-scoped workflow state filtering.
- Add explicit active/completed/canceled issue filters if needed.
- Add comment update/delete operations if teams need agents to correct their own comments.
- Add comment reactions or resolution helpers if they become important to agent workflows.
- Add issue search by text.
- Add OAuth support for package distribution.
- Add optional custom rendering for compact Linear cards.
- Integrate with the separate webhook/event-ingestion system if Pi workflows need event-driven Linear updates.
