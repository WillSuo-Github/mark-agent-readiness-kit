import test from "node:test";
import assert from "node:assert/strict";
import {
  analyzeHome,
  analyzeLlms,
  buildAuditFromEndpointResults,
  generateMarkdownReport,
  gradeForScore,
  normalizeTarget
} from "../src/audit.mjs";

test("normalizeTarget adds https to hostnames", () => {
  const target = normalizeTarget("docs.example.com");
  assert.equal(target.toString(), "https://docs.example.com/");
});

test("analyzeLlms rewards structured agent-readable content", () => {
  const body = `# Example Product
> Example helps teams audit agent readiness before launch.

## Docs
- [Quickstart](https://example.com/docs)
- [API](https://example.com/api)
- [Auth](https://example.com/auth)
- [Errors](https://example.com/errors)
- [Changelog](https://example.com/changelog)

## Examples
Use the API with scoped OAuth tokens.

## Optional
Legacy endpoints are not recommended.`;

  const analysis = analyzeLlms({ ok: true, body });
  assert.equal(analysis.present, true);
  assert.equal(analysis.h1Count, 1);
  assert.ok(analysis.qualityScore >= 9);
});

test("analyzeHome detects capability metadata link hints", () => {
  const home = analyzeHome({
    ok: true,
    headers: { link: '<https://example.com/.well-known/mcp.json>; rel="service-desc"' },
    body: '<html><a href="/openapi.yaml">OpenAPI</a><a href="/.well-known/agent.json">Agent card</a></html>'
  });

  assert.equal(home.linksOpenApi, true);
  assert.equal(home.linksAgentMetadata, true);
});

test("buildAuditFromEndpointResults scores a complete fixture above partial readiness", () => {
  const fixture = {
    home: {
      ok: true,
      status: 200,
      url: "https://example.com/",
      headers: { "content-type": "text/html" },
      body: '<html><head><script type="application/ld+json">{"@context":"https://schema.org"}</script><link rel="alternate" href="/llms.txt"></head></html>'
    },
    robots: {
      ok: true,
      status: 200,
      url: "https://example.com/robots.txt",
      headers: {},
      body: "User-agent: *\nAllow: /\nUser-agent: GPTBot\nAllow: /\n"
    },
    sitemap: {
      ok: true,
      status: 200,
      url: "https://example.com/sitemap.xml",
      headers: {},
      body: "<urlset><url><loc>https://example.com/docs</loc></url></urlset>"
    },
    llms: {
      ok: true,
      status: 200,
      url: "https://example.com/llms.txt",
      headers: {},
      body: "# Example\n> Example gives agents safe docs and API context.\n\n## Docs\n[Quickstart](/docs)\n[API](/api)\n[Auth](/auth)\n[Errors](/errors)\n[Changelog](/changelog)\n\n## Optional\nOld API is deprecated."
    },
    llmsFull: { ok: true, status: 200, url: "https://example.com/llms-full.txt", headers: {}, body: "# Full docs" },
    agents: { ok: true, status: 200, url: "https://example.com/AGENTS.md", headers: {}, body: "# Agent rules" },
    openapiWellKnown: {
      ok: true,
      status: 200,
      url: "https://example.com/.well-known/openapi.json",
      headers: { "content-type": "application/json" },
      body: '{"openapi":"3.1.0","paths":{"/v1/audit":{"get":{"operationId":"createAudit"}}}}'
    },
    mcp: {
      ok: true,
      status: 200,
      url: "https://example.com/.well-known/mcp.json",
      headers: {},
      body: '{"tools":[{"name":"audit"}],"resources":[]}'
    },
    oauth: {
      ok: true,
      status: 200,
      url: "https://example.com/.well-known/oauth-authorization-server",
      headers: {},
      body: '{"issuer":"https://example.com","authorization_endpoint":"https://example.com/oauth/authorize","token_endpoint":"https://example.com/oauth/token"}'
    },
    protectedResource: {
      ok: true,
      status: 200,
      url: "https://example.com/.well-known/oauth-protected-resource",
      headers: {},
      body: '{"resource":"https://example.com/api","authorization_servers":["https://example.com"]}'
    }
  };

  const audit = buildAuditFromEndpointResults("https://example.com", fixture);
  assert.ok(audit.score >= 80);
  assert.equal(audit.grade, "A");
  assert.match(generateMarkdownReport(audit), /MARK Audit/);
});

test("html fallbacks are not treated as valid machine-readable metadata", () => {
  const html = "<!doctype html><html><body>fallback page</body></html>";
  const fixture = {
    home: { ok: true, status: 200, url: "https://example.com/", headers: { "content-type": "text/html" }, body: html },
    robots: { ok: true, status: 200, url: "https://example.com/robots.txt", headers: {}, body: "User-agent: *\nAllow: /\n" },
    sitemap: { ok: false, status: 404, url: "https://example.com/sitemap.xml", headers: {}, body: "" },
    llms: { ok: false, status: 404, url: "https://example.com/llms.txt", headers: {}, body: "" },
    openapiWellKnown: { ok: true, status: 200, url: "https://example.com/.well-known/openapi.json", headers: { "content-type": "text/html" }, body: html },
    mcp: { ok: true, status: 200, url: "https://example.com/.well-known/mcp.json", headers: { "content-type": "text/html" }, body: html },
    oauth: { ok: true, status: 200, url: "https://example.com/.well-known/oauth-authorization-server", headers: { "content-type": "text/html" }, body: html }
  };

  const audit = buildAuditFromEndpointResults("https://example.com", fixture);
  assert.equal(audit.analyses.openapi.present, false);
  assert.equal(audit.analyses.mcp.present, false);
  assert.equal(audit.analyses.oauth.authorizationServerMetadata, false);
  assert.ok(audit.evidence.some((item) => item.status === "html fallback 200"));
});

test("docs profile reduces capability weight for documentation surfaces", () => {
  const fixture = {
    home: { ok: true, status: 200, url: "https://docs.example.com/", headers: { "content-type": "text/html" }, body: "<html></html>" },
    robots: { ok: true, status: 200, url: "https://docs.example.com/robots.txt", headers: {}, body: "User-agent: *\nAllow: /\n" },
    sitemap: { ok: true, status: 200, url: "https://docs.example.com/sitemap.xml", headers: {}, body: "<loc>https://docs.example.com/a</loc>" },
    llms: { ok: true, status: 200, url: "https://docs.example.com/llms.txt", headers: {}, body: "# Docs\n> Useful agent summary.\n\n## Pages\n[One](/one)\n[Two](/two)\n[Three](/three)\n[Four](/four)\n[Five](/five)" }
  };

  const apiAudit = buildAuditFromEndpointResults("https://docs.example.com", fixture, { profile: "api" });
  const docsAudit = buildAuditFromEndpointResults("https://docs.example.com", fixture, { profile: "docs" });
  assert.equal(docsAudit.profile, "docs");
  assert.ok(docsAudit.score > apiAudit.score);
  assert.equal(docsAudit.categoryMaxScores.capabilities, 10);
});

test("gradeForScore maps bands predictably", () => {
  assert.equal(gradeForScore(90), "A");
  assert.equal(gradeForScore(72), "B");
  assert.equal(gradeForScore(55), "C");
  assert.equal(gradeForScore(40), "D");
  assert.equal(gradeForScore(10), "F");
});
