# Privacy

MARK v0.1 is local-first.

## What It Reads

- Public URLs derived from the target hostname or URL.
- Public files such as `robots.txt`, `sitemap.xml`, `llms.txt`, OpenAPI candidates, MCP-like descriptors, OAuth metadata, and related `.well-known` paths.

## What It Does Not Read

- Browser cookies
- Passwords or API keys
- Private repositories
- Authenticated docs
- Local browsing history
- Clipboard contents
- Personal files outside the report output path selected by the user

## What It Sends

The CLI sends ordinary HTTP GET requests to the audited public target. It does not send reports, telemetry, credentials, or analytics to MARK.

## Output

Reports are written locally when `--out` or config `output` is provided. JSON reports may contain public URLs and endpoint statuses for the audited target.

## Future Credentialed Modes

Credentialed checks are intentionally out of scope for v0.1. If added later, they should require explicit user approval, narrow scoping, and separate documentation.
