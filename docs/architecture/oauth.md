# Future OAuth support

The pi-linear extension currently authenticates with a personal API key via `LINEAR_API_KEY`. That matches local agent use: one user, one workspace, minimal setup.

## Why OAuth may be needed later

OAuth becomes worthwhile when the package is distributed to multiple users who should not share one API key, or when installation flows need browser-based consent instead of manual key export.

## Proposed direction (not implemented)

1. **OAuth app registration** — Register a Linear OAuth application with redirect URLs for Pi or a small companion setup command.
2. **Token storage** — Store access and refresh tokens outside the repo (OS keychain or Pi-managed secrets), never in project files or agent context.
3. **Client factory** — Extend `createLinearClient` to choose API key vs OAuth token based on configuration, keeping lazy initialization and cache reset behavior.
4. **Setup UX** — Add a slash command or Pi prompt flow that completes authorization and confirms workspace access with the same non-leaking diagnostics as `/linear-status`.
5. **Error handling** — Reuse `normalizeLinearApiError` so expired or revoked OAuth sessions surface as authentication failures with actionable messages.

## Out of scope for TASK-0023

OAuth implementation, secure OS credential storage, and multi-workspace account switching remain follow-ups until package distribution requires them.
