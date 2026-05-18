id: TASK-0016
status: todo
summary: Prepare the Linear extension for open-source package distribution

# Goal
Make the repository understandable, installable, and safe to publish as an open-source Pi extension.

# Problem
The implementation is usable locally, but lacks the public-facing documentation, package metadata, and release hygiene expected by outside users.

# Scope
In scope:
- Add a top-level README with install, configuration, usage examples, tool list, command list, limitations, and troubleshooting.
- Add license, contributing, security, and code of conduct docs if absent.
- Review `package.json` for publish readiness: package name, description, repository, license, files, exports/main/types, and `private` setting.
- Document whether Pi should load `src/index.ts` or built `dist/index.js` for local and published installs.
- Add a manual Linear sandbox smoke-test checklist.

Out of scope:
- OAuth authentication.
- New Linear API features.
- Automated publishing pipeline beyond package metadata and docs.

# Functional requirements
## 1) Public README
The README must let a new user install, configure, run, and verify the extension without reading the PRD.

## 2) Package metadata
The package must contain enough metadata for npm/GitHub users to discover the project and understand supported runtime expectations.

## 3) Manual verification docs
Document a safe smoke test that creates, reads, updates, comments on, and cleans up a test Linear issue.

# Acceptance criteria
- [ ] `README.md` exists and covers install, auth, usage, tools, commands, troubleshooting, and limitations.
- [ ] Open-source repository docs exist or are explicitly deferred with rationale.
- [ ] `package.json` is publish-ready or documents why publication remains deferred.
- [ ] Manual sandbox smoke-test steps are documented.
- [ ] Existing tests and build still pass.

# Testing expectations
- Run `npm run ci`.
- Follow the README locally in a clean shell as a documentation smoke test.
- If credentials are available, execute the documented Linear sandbox smoke test.

# Risks and mitigations
- Risk: Publishing source TypeScript may not work for all Pi installations.
  - Mitigation: Verify and document the supported package entrypoint strategy.

# Follow-ups
- Add automated npm release workflow after the first public release process is proven manually.
