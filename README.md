# MARK

MARK is the Machine Agent Readiness Kit: a deterministic audit tool for product teams that want their websites, docs, and APIs to be usable by AI agents.

It checks for the signals an agent needs before it can safely reason about or call a product:

- Discovery: `robots.txt`, `sitemap.xml`, `llms.txt`, `AGENTS.md`, link hints
- Agent-readable content: structured `llms.txt`, markdown-friendly docs signals, JSON-LD
- Capability metadata: OpenAPI, MCP, API catalogs, plugin manifests
- Trust and auth: HTTPS, OAuth metadata, protected resource metadata, explicit crawler policy

MARK does not claim official conformance to AgentReady, MCP, or `llms.txt`. It is a private, CI-friendly readiness audit and remediation checklist.

## Run an audit

```bash
npm run audit -- https://example.com --profile api
```

Write JSON:

```bash
npm run audit -- docs.example.com --profile docs --json --out report.json
```

Use a CI threshold:

```bash
npm run audit -- https://example.com --fail-under 70
```

Use a committed config file:

```bash
npm run audit -- --config mark.config.json
```

See [docs/ci-quickstart.md](/Users/willsuo/files/Github/Mark/Mark-2/docs/ci-quickstart.md) for config keys and GitHub Actions usage.

Profiles:

- `api`: default; weights OpenAPI, MCP, and auth metadata heavily
- `docs`: weights discovery and agent-readable docs more heavily
- `content`: weights discovery and content structure over action/API metadata

Scoring details: [docs/scoring.md](/Users/willsuo/files/Github/Mark/Mark-2/docs/scoring.md)

## View the report UI

Open [site/index.html](/Users/willsuo/files/Github/Mark/Mark-2/site/index.html) in a browser and paste the JSON output from the CLI. The page also includes a built-in demo report.

## Development

```bash
npm test
npm run check
```

Privacy model: [docs/privacy.md](/Users/willsuo/files/Github/Mark/Mark-2/docs/privacy.md)
