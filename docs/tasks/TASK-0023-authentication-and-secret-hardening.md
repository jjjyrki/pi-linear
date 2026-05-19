id: TASK-0023
status: done
summary: Harden Linear authentication, errors, and secret handling for public use

# Goal
Make authentication behavior safe and clear for open-source users and teams.

# Problem
The extension supports `LINEAR_API_KEY`, but public distribution needs stronger documentation, clearer errors, and protection against accidental token exposure. Broader team use may require OAuth later.

# Scope
In scope:
- Normalize common authentication, permission, rate-limit, network, and not-found errors.
- Add tests proving tokens are not included in tool results, command output, or normalized errors.
- Improve `/linear-status` diagnostics without leaking secrets.
- Document required Linear API scopes/permissions if applicable.
- Add an architecture note for future OAuth support.

Out of scope:
- Implementing OAuth in this task.
- Secure OS credential storage.
- Multi-workspace account switching.

# Functional requirements
## 1) Safe errors
Errors must be actionable but must not include API keys or raw secret-bearing payloads.

## 2) Auth diagnostics
`/linear-status` should distinguish missing key, invalid key, permission failure, and connectivity failure when possible.

## 3) Public security docs
Users must know how to report vulnerabilities and how to configure secrets safely.

# Acceptance criteria
- [x] Common SDK/network errors are normalized with operation context.
- [x] Tests assert token values are not leaked in errors or command output.
- [x] `/linear-status` gives actionable non-secret diagnostics.
- [x] README/security docs cover secret configuration and reporting.
- [x] Existing tests and build still pass.

# Testing expectations
- Unit-test missing, blank, invalid, permission, rate-limit, and network-style error paths with mocked SDK errors.
- Run `npm run ci`.
- Manually verify `/linear-status` with missing and invalid credentials.

# Risks and mitigations
- Risk: Over-normalizing errors can hide useful debugging details.
  - Mitigation: Preserve safe operation context while redacting only sensitive data.

# Follow-ups
- Implement OAuth when package distribution requires multi-user auth.
