id: TASK-0022
status: todo
summary: Add a Linear issue context-pack tool for agent implementation sessions

# Goal
Give agents a single tool call that gathers the Linear context needed to start or continue implementation work.

# Problem
Agents often need to read an issue, comments, parent/subissue context, relations, labels, and recent status before deciding what to do. Today this requires several separate calls and manual synthesis.

# Scope
In scope:
- Add `linear_get_issue_context` accepting an issue UUID or identifier.
- Return the issue description, recent comments, parent summary, child issue summaries, relation summaries, labels, assignee, state, project/cycle metadata when available, and URLs.
- Support bounded options such as comment limit, include children, include relations, and include completed children.
- Keep output compact and structured for model consumption.

Out of scope:
- Summarization using an LLM inside the tool.
- Fetching external PR/code content from links.
- Unbounded workspace crawling.

# Functional requirements
## 1) Single-call context gathering
Agents can retrieve implementation-ready issue context with one tool call.

## 2) Bounded response
The tool must cap comments, child issues, and relations to prevent excessive context usage.

## 3) Structured details
The result must include machine-readable normalized objects, not only text.

# Acceptance criteria
- [ ] `linear_get_issue_context` is registered and documented.
- [ ] Context includes issue details and recent comments by default.
- [ ] Optional child and relation context works with documented bounds.
- [ ] Output clearly indicates when data is truncated.
- [ ] Existing tests and build still pass.

# Testing expectations
- Unit-test context composition with mocked issue, comments, children, and relations.
- Unit-test bounds and truncation flags.
- Unit-test issue identifier resolution.
- Run `npm run ci`.

# Risks and mitigations
- Risk: Context packs can become too large for the model.
  - Mitigation: Default to conservative limits and expose explicit include options.

# Follow-ups
- Add optional context summaries after raw structured context is proven useful.
