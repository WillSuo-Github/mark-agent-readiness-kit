# GitHub Action

MARK can run as a local repository action before package publishing.

With explicit action inputs:

```yaml
name: Agent readiness

on:
  pull_request:
  workflow_dispatch:

jobs:
  mark:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: ./
        with:
          target: https://docs.example.com
          profile: docs
          fail-under: "70"
          output: mark-report.md
      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: mark-report
          path: mark-report.md
```

With a committed `mark.config.json`:

```yaml
- uses: ./
  with:
    config: mark.config.json
```

This wrapper is intentionally simple. Public marketplace publication, package registry publication, and branded launch copy remain approval-gated.
