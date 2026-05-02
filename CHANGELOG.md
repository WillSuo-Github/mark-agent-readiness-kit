# Changelog

## 0.1.1 - 2026-05-02

Post-publish activation fix.

- Added `mark-agent-readiness-kit` as a zero-install npm bin alias.
- Added npm and global-install usage examples to README.
- Replaced local absolute README links with relative links for GitHub and npm.

## 0.1.0 - 2026-05-02

Initial public MVP.

- Added deterministic agent-readiness audit CLI.
- Added `api`, `docs`, and `content` scoring profiles.
- Added Markdown and JSON report output.
- Added config-file support with `mark.config.json`.
- Added report JSON schema.
- Added static report viewer with demo mode.
- Added local GitHub Action wrapper.
- Added HTML fallback detection for metadata URLs that return `200 OK` with non-machine-readable content.

No hosted service, telemetry, or external launch has been completed.
