id: TASK-0006
status: todo
summary: Implement Linear slash commands and complete MVP QA

# Goal
Finish the Pi user-facing command surface and verify the package against the PRD.

# Problem
The extension needs lightweight slash commands for discoverability, setup checks, and tool inspection, plus final tests that prove the MVP works as a Pi package.

# Dependencies
- `TASK-0001` for package registration.
- `TASK-0002` for auth helpers and shared output/error behavior.
- `TASK-0003` for issue tools.
- `TASK-0004` for comment tools.
- `TASK-0005` for discovery tools.

# Scope
In scope:
- Implement `/linear`.
- Implement `/linear-status`.
- Implement `/linear-tools`.
- Replace slash command placeholders.
- Add final PRD-level tests and manual QA notes.
- Update README or usage docs if implementation details differ from the PRD.

Out of scope:
- Slash commands that duplicate issue mutations, such as `/linear-create`.
- Custom TUI components.
- OAuth setup.
- Webhook handling.

# Functional Requirements
## `/linear`
- Show a short help card for the extension.
- Indicate whether `LINEAR_API_KEY` appears configured without printing the value.
- List available agent tools at a high level.
- Include example prompts users can type.
- Explain that issue and comment operations are performed by agent tools.

## `/linear-status`
- Check whether `LINEAR_API_KEY` is present without printing it.
- Optionally perform a low-cost SDK connectivity check if safe and reliable.
- Return a clear next step when credentials are missing.
- Avoid stack traces for expected setup failures.

## `/linear-tools`
- List all eleven Linear tools and their required inputs.
- Keep output concise enough to read inside Pi.

## Final QA
- Verify tool and command registration through the Pi extension entrypoint.
- Verify missing-auth behavior does not expose secrets.
- Verify package install/load instructions still match reality.

# Acceptance Criteria
- [ ] Users can run `/linear` for help and examples.
- [ ] Users can run `/linear-status` to validate setup safely.
- [ ] Users can run `/linear-tools` to inspect the tool surface.
- [ ] All eleven tools and three slash commands are registered from `src/index.ts`.
- [ ] The package can be loaded by Pi as an extension.
- [ ] PRD acceptance criteria are either satisfied or explicitly deferred.

# Testing Expectations
- Unit-test slash command handlers with mocked Pi command contexts where practical.
- Add an extension registration test that verifies all tool and command names.
- Run all unit tests.
- Run lint/typecheck/build checks configured for the package.
- Add a documented manual smoke test using a Linear sandbox workspace when credentials are available.

# Risks And Mitigations
- Risk: Connectivity checks could consume too much time or fail for reasons unrelated to auth.
  - Mitigation: Keep `/linear-status` connectivity optional and make missing-token checks deterministic.
- Risk: Command help can drift from tool schemas.
  - Mitigation: Keep command output generated from shared tool metadata where practical.

# Follow-Ups
- Implement future PRD items only after the MVP is complete and reviewed.
