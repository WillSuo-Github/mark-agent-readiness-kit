# MARK Support Notes

## What MARK Does

MARK checks whether a public product surface exposes enough machine-readable signals for AI agents to discover, understand, and call it safely.

It currently checks:

- `robots.txt`, `sitemap.xml`, `llms.txt`, `llms-full.txt`, and `AGENTS.md`
- OpenAPI candidates under stable root and `.well-known` paths
- MCP-like manifests, agent cards, API catalogs, and AI plugin manifests
- OAuth authorization-server and protected-resource metadata
- HTML fallback behavior that can look like success but is not valid metadata
- Homepage JSON-LD and link hints

## Profiles

- `api`: default. Use for API products, developer platforms, SaaS products with programmatic actions, and integrations.
- `docs`: use for documentation surfaces where discoverability and agent-readable content matter more than API metadata.
- `content`: use for knowledge sites, publications, and reference pages that mostly need LLM-readable content.

## Score Interpretation

The score is a readiness heuristic, not a certification. A low score can mean:

- the site lacks agent-specific entrypoints
- the site returns HTML fallback pages for metadata URLs
- the selected profile is too strict for the surface
- key docs are available only behind JavaScript or authentication
- the product intentionally does not expose API/action metadata

## Privacy

The CLI fetches public URLs only and writes local reports. It does not collect telemetry, credentials, cookies, or private data.

## Known Limits

- No browser rendering in v0.1; JavaScript-rendered metadata may be missed.
- No official AgentReady, MCP, or `llms.txt` conformance claim.
- No LLM interpretation yet; all checks are deterministic.
- Authenticated docs and private APIs are out of scope unless the user later approves a credentialed mode.

## First Response Templates

### Why did my docs score low?

MARK weights the selected profile. Try `--profile docs` for documentation sites and `--profile content` for knowledge/reference sites. If the score is still low, inspect the recommendations and evidence table; HTML fallback rows often explain why a 200 status was not accepted as valid metadata.

### Is this an official certification?

No. MARK is a private readiness audit that composes practical signals from `llms.txt`, OpenAPI, MCP-style descriptors, OAuth metadata, and crawler policy. It should not be presented as official AgentReady, MCP, or `llms.txt` certification.

### Does MARK need my API key?

No for v0.1. It audits public surfaces only. Credentialed checks are intentionally out of scope until there is explicit user demand and approval for handling secrets.
