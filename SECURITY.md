# Security Policy

## Supported versions

Security fixes are applied to the latest release on the default branch.

## Reporting a vulnerability

Do not open a public GitHub issue for security vulnerabilities.

Instead, report them privately to the repository maintainer through GitHub Security Advisories or direct contact if you already have a private channel. Include:

- A clear description of the issue and impact
- Steps to reproduce
- Affected versions or commits
- Any suggested fix, if you have one

We aim to acknowledge reports within a few business days.

## Configuring secrets safely

- Set `LINEAR_API_KEY` in your shell environment or a secrets manager. Do not commit API keys to git, task files, or agent prompts.
- Use a personal API key from [Linear account security settings](https://linear.app/settings/account/security).
- Grant only the access the extension needs. Issue and comment tools require read/write access to the workspaces and teams you use.
- Rotate keys if they may have been exposed in logs, chat transcripts, or screen shares.
- Run `/linear-status` to verify configuration. It reports whether a key is present and whether Linear accepts it without printing the key value.

## What the extension redacts

The extension redacts `LINEAR_API_KEY` values and common `lin_api_*` token patterns from normalized errors and `/linear-status` diagnostics. It does not guarantee redaction in third-party logs outside this package.
