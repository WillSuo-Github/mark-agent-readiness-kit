# CI Quickstart

MARK can run from one committed config file.

## 1. Add a config file

```json
{
  "target": "https://docs.example.com",
  "profile": "docs",
  "format": "markdown",
  "output": "mark-report.md",
  "failUnder": 70,
  "timeoutMs": 8000
}
```

Supported keys:

- `target`: URL or hostname to audit
- `profile`: `api`, `docs`, or `content`
- `format`: `json` or `markdown`
- `output`: report path
- `failUnder`: optional score threshold
- `timeoutMs`: request timeout per checked URL

## 2. Run locally

```bash
npx mark-agent-readiness-kit --config mark.config.json
```

CLI flags override config values:

```bash
npx mark-agent-readiness-kit --config mark.config.json --profile api --json --out report.json
```

## 3. Run in GitHub Actions

```yaml
- uses: ./
  with:
    target: https://docs.example.com
    profile: docs
    fail-under: "70"
    output: mark-report.md
```

The JSON report shape is documented in [report.schema.json](../schemas/report.schema.json).
