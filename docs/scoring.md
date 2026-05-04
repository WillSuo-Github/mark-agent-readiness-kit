# Scoring

MARK scores readiness as a practical heuristic, not as certification.

## Categories

- Discoverability: whether agents can find canonical machine-readable entrypoints.
- Agent-readable content: whether the product provides structured, concise, low-ambiguity context.
- Capabilities: whether actions and APIs are described in stable machine-readable contracts.
- Trust and auth: whether agents can reason about HTTPS, crawler policy, and authorization metadata.

## Profiles

| Profile | Best for | Category weighting |
| --- | --- | --- |
| `api` | API products, SaaS products with integrations, developer platforms | Capabilities and auth carry heavier weight |
| `docs` | Documentation surfaces and developer docs | Discovery and content carry heavier weight |
| `content` | Reference sites, knowledge bases, publications | Discovery and content dominate; action metadata is low weight |

## Grades

| Grade | Score | Meaning |
| --- | ---: | --- |
| A | 85-100 | Strong deterministic readiness |
| B | 70-84 | Good baseline with clear remaining gaps |
| C | 55-69 | Partial readiness |
| D | 40-54 | Weak readiness |
| F | 0-39 | Not agent-ready yet |

## Common False Signals

- `200 OK` on `/.well-known/openapi.json` can still be an HTML fallback page.
- A docs site may score poorly under `api` even when `docs` is the right profile.
- A site can be intentionally private or non-actionable; in that case, missing OpenAPI or MCP metadata may be acceptable.

## Capability Metadata Placement

For API or action-oriented products, MARK prefers stable machine-readable locations before deep crawling:

- OpenAPI: `/.well-known/openapi.json`, `/openapi.json`, `/openapi.yaml`, or another clearly documented stable URL.
- MCP-style or agent metadata: `/.well-known/mcp.json`, `/.well-known/mcp/server-card.json`, `/.well-known/agent.json`, or `/.well-known/api-catalog`.
- Homepage or docs entrypoint links should expose these files so tools can find them quickly.
- `/llms.txt` should also link to the same metadata, but MARK treats that as backup discovery rather than the only entrypoint.

## Certification

MARK does not claim official conformance to AgentReady, MCP, `llms.txt`, OpenAPI, or OAuth standards. It is a private readiness audit and remediation checklist.
