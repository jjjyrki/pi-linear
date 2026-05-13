id: TASK-0001
status: done
summary: Scaffold the Pi Linear package and register the extension entrypoint

# Goal
Create the package structure needed for Pi to load the Linear extension from `src/index.ts`.

# Problem
The PRD defines the tool and command surface, but the repository does not yet contain a package scaffold, entrypoint, dependencies, or registration wiring.

# Scope
In scope:
- Add `package.json` with ESM configuration and the `pi.extensions` manifest pointing at `./src/index.ts`.
- Add TypeScript project configuration and a minimal test setup that matches the package style.
- Add `src/index.ts` as the default-export Pi extension factory.
- Create placeholder registration modules for tools and slash commands without implementing Linear behavior yet.
- Add the planned source directory structure from the PRD.

Out of scope:
- Calling the Linear SDK.
- Implementing tool handlers.
- Implementing slash command behavior beyond registration stubs.
- Adding custom rendering.

# Functional Requirements
## Package Manifest
- The package must be loadable by Pi using the manifest extension path `./src/index.ts`.
- The package must depend on `@linear/sdk`.
- Pi-related packages should be peer dependencies when imported directly.
- The package must use `"type": "module"`.

## Extension Entrypoint
- `src/index.ts` must default-export the Pi extension factory.
- The extension must register all eleven planned tool names and the three slash command names through placeholder handlers.
- Placeholder handlers must fail clearly with "not implemented" style errors where behavior is deferred to later tasks.

## Project Structure
- Create stable module locations for client setup, schemas, errors, tool handlers, command handlers, and Linear normalization helpers.

# Acceptance Criteria
- [ ] Pi can discover the extension through the `pi.extensions` manifest.
- [ ] `src/index.ts` registers the planned tool and command names.
- [ ] Placeholder handlers do not call Linear or require `LINEAR_API_KEY`.
- [ ] The package has a repeatable test command, even if tests are minimal in this phase.

# Testing Expectations
- Add a smoke test that imports the extension entrypoint and verifies it can be initialized with mocked Pi registration functions.
- Run the package test command.

# Risks And Mitigations
- Risk: Pi extension APIs may require exact import paths or registration signatures.
  - Mitigation: Check the Pi extension docs and examples before wiring imports.
- Risk: Placeholder handlers could be mistaken for completed tools.
  - Mitigation: Make placeholder errors explicit and remove them in later implementation tasks.

# Follow-Ups
- Implement shared Linear client setup, schemas, validation, and normalization in `TASK-0002`.
