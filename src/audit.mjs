const DEFAULT_TIMEOUT_MS = 8000;
const MAX_BODY_CHARS = 700_000;

const AI_BOTS = [
  "GPTBot",
  "ChatGPT-User",
  "ClaudeBot",
  "Claude-User",
  "PerplexityBot",
  "Google-Extended",
  "Bytespider",
  "CCBot",
  "Applebot-Extended",
  "OAI-SearchBot"
];

const ENDPOINTS = [
  { key: "home", label: "Homepage", path: "/" },
  { key: "robots", label: "robots.txt", path: "/robots.txt" },
  { key: "sitemap", label: "sitemap.xml", path: "/sitemap.xml" },
  { key: "llms", label: "llms.txt", path: "/llms.txt" },
  { key: "llmsFull", label: "llms-full.txt", path: "/llms-full.txt" },
  { key: "agents", label: "AGENTS.md", path: "/AGENTS.md" },
  { key: "openapiWellKnown", label: "OpenAPI well-known JSON", path: "/.well-known/openapi.json" },
  { key: "openapiRootJson", label: "OpenAPI root JSON", path: "/openapi.json" },
  { key: "openapiRootYaml", label: "OpenAPI root YAML", path: "/openapi.yaml" },
  { key: "mcp", label: "MCP well-known manifest", path: "/.well-known/mcp.json" },
  { key: "mcpServerCard", label: "MCP server card", path: "/.well-known/mcp/server-card.json" },
  { key: "agentCard", label: "Agent card", path: "/.well-known/agent.json" },
  { key: "apiCatalog", label: "API catalog", path: "/.well-known/api-catalog" },
  { key: "oauth", label: "OAuth authorization server metadata", path: "/.well-known/oauth-authorization-server" },
  { key: "protectedResource", label: "OAuth protected resource metadata", path: "/.well-known/oauth-protected-resource" },
  { key: "aiPlugin", label: "AI plugin manifest", path: "/.well-known/ai-plugin.json" }
];

const PROFILE_MAX_SCORES = {
  api: {
    discoverability: 30,
    agentContent: 25,
    capabilities: 25,
    trustAndAuth: 20
  },
  docs: {
    discoverability: 35,
    agentContent: 35,
    capabilities: 10,
    trustAndAuth: 20
  },
  content: {
    discoverability: 40,
    agentContent: 40,
    capabilities: 5,
    trustAndAuth: 15
  }
};

const RECOMMENDATION_COPY = {
  robots: "Publish an explicit AI crawler policy in robots.txt so agents can detect crawl consent and constraints.",
  sitemap: "Expose sitemap.xml so agents can discover canonical docs, pricing, changelog, and support pages.",
  llms: "Add /llms.txt with concise product context, canonical docs links, API references, examples, and constraints.",
  llmsQuality: "Improve /llms.txt structure with a clear H1, one-paragraph summary, sections, and high-signal links.",
  openapi: "If the product exposes a public API, publish OpenAPI at a stable well-known or root URL, link it from docs/homepage, and include it in /llms.txt as backup discovery.",
  mcp: "If the product has actions or private data, publish MCP-style or agent metadata at a stable .well-known path, link it from docs/homepage, and include it in /llms.txt as backup discovery.",
  oauth: "Publish OAuth metadata so agents can discover authorization flows without scraping docs.",
  jsonld: "Add JSON-LD or equivalent structured data on key pages to reduce extraction ambiguity.",
  https: "Serve the target over HTTPS; agent integrations should not bootstrap from plain HTTP."
};

export function endpointDefinitions() {
  return ENDPOINTS.map((endpoint) => ({ ...endpoint }));
}

export function normalizeTarget(input) {
  if (!input || typeof input !== "string") {
    throw new Error("A target URL or hostname is required.");
  }

  const trimmed = input.trim();
  const withProtocol = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  const parsed = new URL(withProtocol);
  parsed.hash = "";

  if (!parsed.pathname) {
    parsed.pathname = "/";
  }

  return parsed;
}

function endpointUrl(baseUrl, path) {
  return new URL(path, `${baseUrl.protocol}//${baseUrl.host}`).toString();
}

function headersToObject(headers) {
  const output = {};
  for (const [key, value] of headers.entries()) {
    output[key.toLowerCase()] = value;
  }
  return output;
}

export async function fetchText(url, options = {}) {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "accept": "text/html,application/json,application/yaml,text/yaml,text/markdown,text/plain,*/*;q=0.7",
        "user-agent": "MARK-Agent-Readiness-Auditor/0.1 (+https://example.invalid/mark)"
      }
    });

    const text = await response.text();
    return {
      ok: response.ok,
      status: response.status,
      finalUrl: response.url,
      headers: headersToObject(response.headers),
      body: text.slice(0, MAX_BODY_CHARS),
      bodyBytesRead: text.length
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      finalUrl: url,
      headers: {},
      body: "",
      error: error?.name === "AbortError" ? `Timed out after ${timeoutMs}ms` : String(error?.message ?? error)
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function auditTarget(input, options = {}) {
  const target = normalizeTarget(input);
  const fetcher = options.fetcher ?? fetchText;
  const endpoints = options.endpoints ?? ENDPOINTS;

  const entries = await Promise.all(
    endpoints.map(async (endpoint) => {
      const url = endpointUrl(target, endpoint.path);
      const result = await fetcher(url, options);
      return [
        endpoint.key,
        {
          ...endpoint,
          url,
          ok: Boolean(result.ok),
          status: result.status ?? 0,
          finalUrl: result.finalUrl ?? url,
          headers: result.headers ?? {},
          body: result.body ?? "",
          bodyBytesRead: result.bodyBytesRead ?? 0,
          error: result.error
        }
      ];
    })
  );

  return buildAuditFromEndpointResults(target.toString(), Object.fromEntries(entries), {
    profile: options.profile
  });
}

export function buildAuditFromEndpointResults(targetInput, endpointResults, options = {}) {
  const target = normalizeTarget(targetInput);
  const profile = normalizeProfile(options.profile);
  const analyses = {
    home: analyzeHome(endpointResults.home),
    robots: analyzeRobots(endpointResults.robots),
    llms: analyzeLlms(endpointResults.llms),
    openapi: analyzeOpenApi([
      endpointResults.openapiWellKnown,
      endpointResults.openapiRootJson,
      endpointResults.openapiRootYaml
    ]),
    mcp: analyzeMcp([
      endpointResults.mcp,
      endpointResults.mcpServerCard,
      endpointResults.agentCard
    ]),
    oauth: analyzeOAuth(endpointResults.oauth, endpointResults.protectedResource),
    apiCatalog: analyzeApiCatalog(endpointResults.apiCatalog),
    aiPlugin: analyzeAiPlugin(endpointResults.aiPlugin),
    sitemap: analyzeSitemap(endpointResults.sitemap)
  };

  const scoring = scoreAudit(target, endpointResults, analyses, { profile });
  return {
    product: "MARK",
    version: "0.1.0",
    profile,
    auditedAt: new Date().toISOString(),
    target: `${target.protocol}//${target.host}`,
    score: scoring.total,
    grade: gradeForScore(scoring.total),
    categoryScores: scoring.categoryScores,
    categoryMaxScores: scoring.categoryMaxScores,
    summary: scoring.summary,
    recommendations: scoring.recommendations,
    findings: scoring.findings,
    evidence: summarizeEvidence(endpointResults, analyses),
    analyses
  };
}

export function analyzeRobots(result) {
  if (!result?.ok) {
    return {
      present: false,
      mentionedBots: [],
      hasGlobalPolicy: false,
      hasContentSignals: false,
      blocksAllCrawlers: false,
      clearAgentPolicy: false
    };
  }

  const body = result.body ?? "";
  const mentionedBots = AI_BOTS.filter((bot) => new RegExp(`user-agent:\\s*${escapeRegExp(bot)}`, "i").test(body));
  const hasGlobalPolicy = /user-agent:\s*\*/i.test(body);
  const hasContentSignals = /content-signal|ai-input|ai-train|search/i.test(body);
  const blocksAllCrawlers = /user-agent:\s*\*[\s\S]*?disallow:\s*\/\s*(?:#.*)?$/im.test(body);
  const clearAgentPolicy = mentionedBots.length > 0 || hasGlobalPolicy || hasContentSignals;

  return {
    present: true,
    mentionedBots,
    hasGlobalPolicy,
    hasContentSignals,
    blocksAllCrawlers,
    clearAgentPolicy
  };
}

export function analyzeLlms(result) {
  if (!result?.ok) {
    return {
      present: false,
      qualityScore: 0,
      h1Count: 0,
      h2Count: 0,
      linkCount: 0,
      hasSummary: false,
      hasOptionalSection: false,
      wordCount: 0
    };
  }

  const body = result.body ?? "";
  const h1Count = countMatches(body, /^#\s+\S+/gm);
  const h2Count = countMatches(body, /^##\s+\S+/gm);
  const linkCount = countMatches(body, /\[[^\]]+\]\([^)]+\)/g);
  const hasSummary = /^\s*>.+/m.test(body) || countWords(body.split("\n").slice(0, 8).join(" ")) >= 18;
  const hasOptionalSection = /optional/i.test(body);
  const wordCount = countWords(body);

  let qualityScore = 0;
  if (h1Count > 0) qualityScore += 2;
  if (hasSummary) qualityScore += 2;
  if (h2Count >= 2) qualityScore += 2;
  if (linkCount >= 5) qualityScore += 3;
  if (wordCount >= 80 && wordCount <= 2500) qualityScore += 2;
  if (hasOptionalSection) qualityScore += 1;

  return {
    present: true,
    qualityScore,
    h1Count,
    h2Count,
    linkCount,
    hasSummary,
    hasOptionalSection,
    wordCount
  };
}

export function analyzeHome(result) {
  if (!result?.ok) {
    return {
      reachable: false,
      hasJsonLd: false,
      linksLlmsTxt: false,
      linksOpenApi: false,
      contentType: ""
    };
  }

  const body = result.body ?? "";
  const headers = result.headers ?? {};
  const contentType = headers["content-type"] ?? "";
  const linkHeader = headers.link ?? "";

  return {
    reachable: true,
    hasJsonLd: /application\/ld\+json/i.test(body),
    linksLlmsTxt: /llms\.txt/i.test(body) || /llms\.txt/i.test(linkHeader),
    linksOpenApi: /openapi\.(json|yaml)|swagger/i.test(body) || /openapi/i.test(linkHeader),
    linksAgentMetadata: /\.well-known\/(?:mcp|agent|api-catalog)|mcp\.json|server-card|agent\.json|api-catalog|ai-plugin\.json/i.test(body)
      || /mcp\.json|server-card|agent\.json|api-catalog|ai-plugin\.json/i.test(linkHeader),
    contentType
  };
}

export function analyzeOpenApi(results) {
  const found = (results ?? []).find((result) => result?.ok && looksLikeOpenApi(result.body, result.headers));
  if (!found) {
    return {
      present: false,
      pathCount: 0,
      operationIdCount: 0,
      source: ""
    };
  }

  const body = found.body ?? "";
  return {
    present: true,
    pathCount: countMatches(body, /["']?\/[a-z0-9._~:/?#\[\]@!$&'()*+,;=%-]+["']?\s*:/gi),
    operationIdCount: countMatches(body, /operationId\s*[:"]/gi),
    source: found.url
  };
}

export function analyzeMcp(results) {
  const found = (results ?? []).find((result) => (
    result?.ok
    && !looksLikeHtml(result)
    && /mcp|tools|resources|prompts|capabilities|server|agent/i.test(result.body ?? "")
  ));
  if (!found) {
    return {
      present: false,
      source: ""
    };
  }

  return {
    present: true,
    source: found.url,
    mentionsTools: /tools|resources|prompts|capabilities/i.test(found.body ?? "")
  };
}

export function analyzeOAuth(oauthResult, protectedResourceResult) {
  return {
    authorizationServerMetadata: looksLikeMachineMetadata(oauthResult, [
      "issuer",
      "authorization_endpoint",
      "token_endpoint",
      "jwks_uri"
    ]),
    protectedResourceMetadata: looksLikeMachineMetadata(protectedResourceResult, [
      "resource",
      "authorization_servers",
      "bearer_methods_supported"
    ])
  };
}

export function analyzeApiCatalog(result) {
  return {
    present: looksLikeMachineMetadata(result, ["apis", "openapi", "name", "description"])
  };
}

export function analyzeAiPlugin(result) {
  return {
    present: looksLikeMachineMetadata(result, ["schema_version", "api", "auth", "name_for_model"])
  };
}

export function analyzeSitemap(result) {
  if (!result?.ok) {
    return {
      present: false,
      urlCount: 0
    };
  }

  return {
    present: true,
    urlCount: countMatches(result.body ?? "", /<loc>/gi)
  };
}

export function scoreAudit(targetUrl, endpoints, analyses, options = {}) {
  const profile = normalizeProfile(options.profile);
  const rawCategoryScores = {
    discoverability: 0,
    agentContent: 0,
    capabilities: 0,
    trustAndAuth: 0
  };
  const findings = [];
  const recommendations = [];

  const addFinding = (key, severity, title, detail) => {
    findings.push({ key, severity, title, detail });
    if (RECOMMENDATION_COPY[key]) {
      recommendations.push(RECOMMENDATION_COPY[key]);
    }
  };

  if (endpoints.robots?.ok) {
    rawCategoryScores.discoverability += 6;
  } else {
    addFinding("robots", "medium", "Missing robots.txt", "Agents cannot quickly determine crawler policy.");
  }

  if (analyses.robots.clearAgentPolicy) {
    rawCategoryScores.discoverability += 4;
    rawCategoryScores.trustAndAuth += 3;
  } else {
    addFinding("robots", "medium", "Crawler policy is not explicit", "No AI bot, global, or content-signal policy was detected.");
  }

  if (endpoints.sitemap?.ok) {
    rawCategoryScores.discoverability += 7;
  } else {
    addFinding("sitemap", "medium", "Missing sitemap.xml", "Agents lose a cheap canonical map of important pages.");
  }

  if (endpoints.llms?.ok) {
    rawCategoryScores.discoverability += 8;
  } else {
    addFinding("llms", "high", "Missing llms.txt", "No dedicated agent-readable entrypoint was detected.");
  }

  if (endpoints.llmsFull?.ok) {
    rawCategoryScores.discoverability += 3;
    rawCategoryScores.agentContent += 3;
  }

  if (endpoints.agents?.ok) {
    rawCategoryScores.discoverability += 2;
    rawCategoryScores.agentContent += 2;
  }

  if (analyses.home.linksLlmsTxt) {
    rawCategoryScores.discoverability += 2;
  }

  if (analyses.llms.present) {
    rawCategoryScores.agentContent += Math.min(12, analyses.llms.qualityScore);
    if (analyses.llms.qualityScore < 8) {
      addFinding("llmsQuality", "medium", "llms.txt is thin", "The file exists but lacks enough structure for reliable agent use.");
    }
  }

  if (analyses.home.hasJsonLd) {
    rawCategoryScores.agentContent += 4;
  } else {
    addFinding("jsonld", "low", "No homepage JSON-LD detected", "Structured data would reduce product extraction ambiguity.");
  }

  if (analyses.home.reachable) {
    rawCategoryScores.agentContent += 4;
    rawCategoryScores.trustAndAuth += 2;
  }

  if (analyses.openapi.present) {
    rawCategoryScores.capabilities += 10;
    if (analyses.openapi.operationIdCount > 0) {
      rawCategoryScores.capabilities += 4;
    }
    if (analyses.home.linksOpenApi) {
      rawCategoryScores.capabilities += 2;
    }
  } else {
    addFinding("openapi", profile === "api" ? "high" : "low", "No OpenAPI document detected", "No stable machine-readable API contract was detected.");
  }

  if (analyses.mcp.present) {
    rawCategoryScores.capabilities += analyses.mcp.mentionsTools ? 8 : 6;
    if (analyses.home.linksAgentMetadata) {
      rawCategoryScores.capabilities += 2;
    }
  } else {
    addFinding("mcp", profile === "api" ? "medium" : "low", "No MCP or agent card detected", "If actions matter, an agent-native server descriptor would reduce integration friction.");
  }

  if (analyses.apiCatalog.present) {
    rawCategoryScores.capabilities += 3;
  }

  if (analyses.aiPlugin.present) {
    rawCategoryScores.capabilities += 2;
  }

  if (targetUrl.protocol === "https:") {
    rawCategoryScores.trustAndAuth += 4;
  } else {
    addFinding("https", "high", "Target is not HTTPS", "Agents should not bootstrap trust-sensitive integrations from HTTP.");
  }

  if (analyses.oauth.authorizationServerMetadata) {
    rawCategoryScores.trustAndAuth += 6;
  } else {
    addFinding("oauth", profile === "api" ? "medium" : "low", "No OAuth metadata detected", "Agents may need to scrape docs to understand authorization.");
  }

  if (analyses.oauth.protectedResourceMetadata) {
    rawCategoryScores.trustAndAuth += 3;
  }

  if (analyses.robots.blocksAllCrawlers) {
    rawCategoryScores.trustAndAuth -= 2;
    addFinding("robots", "medium", "Robots policy blocks broad crawling", "This can be valid, but agents need a documented alternative path.");
  }

  const rawMaxScores = {
    discoverability: 30,
    agentContent: 25,
    capabilities: 25,
    trustAndAuth: 20
  };

  for (const key of Object.keys(rawCategoryScores)) {
    rawCategoryScores[key] = Math.max(0, Math.min(rawMaxScores[key], rawCategoryScores[key]));
  }

  const categoryMaxScores = PROFILE_MAX_SCORES[profile];
  const categoryScores = Object.fromEntries(
    Object.entries(rawCategoryScores).map(([key, value]) => [
      key,
      Math.round(value / rawMaxScores[key] * categoryMaxScores[key])
    ])
  );
  const total = Object.values(categoryScores).reduce((sum, value) => sum + value, 0);
  const uniqueRecommendations = [...new Set(recommendations)].slice(0, 8);

  return {
    total,
    categoryScores,
    categoryMaxScores,
    recommendations: uniqueRecommendations,
    findings,
    summary: summarizeScore(total, categoryScores, categoryMaxScores)
  };
}

export function generateMarkdownReport(audit) {
  const scores = audit.categoryScores;
  const maxScores = audit.categoryMaxScores ?? PROFILE_MAX_SCORES.api;
  const recommendations = audit.recommendations.length
    ? audit.recommendations.map((item) => `- ${item}`).join("\n")
    : "- No major deterministic gaps detected.";
  const findings = audit.findings.length
    ? audit.findings.map((item) => `- [${item.severity}] ${item.title}: ${item.detail}`).join("\n")
    : "- No findings.";
  const evidenceRows = audit.evidence
    .map((item) => `| ${item.label} | ${item.status} | ${item.url} |`)
    .join("\n");

  return `# MARK Audit: ${audit.target}

Audited at: ${audit.auditedAt}
Profile: ${audit.profile ?? "api"}

Overall score: ${audit.score}/100 (${audit.grade})

${audit.summary}

## Category scores

| Category | Score |
| --- | ---: |
| Discoverability | ${scores.discoverability}/${maxScores.discoverability} |
| Agent-readable content | ${scores.agentContent}/${maxScores.agentContent} |
| Capabilities | ${scores.capabilities}/${maxScores.capabilities} |
| Trust and auth | ${scores.trustAndAuth}/${maxScores.trustAndAuth} |

## Top recommendations

${recommendations}

## Findings

${findings}

## Evidence

| Signal | Status | URL |
| --- | --- | --- |
${evidenceRows}

Note: MARK is a deterministic private audit. It is not an official conformance test for AgentReady, MCP, or llms.txt.
`;
}

export function gradeForScore(score) {
  if (score >= 85) return "A";
  if (score >= 70) return "B";
  if (score >= 55) return "C";
  if (score >= 40) return "D";
  return "F";
}

function summarizeScore(total, categoryScores, categoryMaxScores) {
  const weakest = Object.entries(categoryScores)
    .sort((a, b) => a[1] / categoryMaxScores[a[0]] - b[1] / categoryMaxScores[b[0]])[0]?.[0] ?? "unknown";
  if (total >= 85) {
    return `Strong agent readiness. The weakest deterministic area is ${humanCategory(weakest)}, but the target exposes most expected machine-readable signals.`;
  }
  if (total >= 70) {
    return `Good baseline. The next leverage point is ${humanCategory(weakest)}.`;
  }
  if (total >= 55) {
    return `Partial readiness. Agents can discover some context, but ${humanCategory(weakest)} will limit reliable use.`;
  }
  if (total >= 40) {
    return `Weak readiness. The product likely requires scraping and human interpretation before an agent can use it.`;
  }
  return "Not agent-ready yet. Build a dedicated agent-readable surface before expecting reliable AI consumption.";
}

function humanCategory(key) {
  return {
    discoverability: "discoverability",
    agentContent: "agent-readable content",
    capabilities: "capability metadata",
    trustAndAuth: "trust and authorization"
  }[key] ?? key;
}

function normalizeProfile(profile) {
  if (!profile) {
    return "api";
  }

  if (PROFILE_MAX_SCORES[profile]) {
    return profile;
  }

  throw new Error(`Unknown MARK profile: ${profile}. Expected one of: ${Object.keys(PROFILE_MAX_SCORES).join(", ")}.`);
}

function summarizeEvidence(endpointResults, analyses = {}) {
  return ENDPOINTS.map((endpoint) => {
    const result = endpointResults[endpoint.key];
    if (!result) {
      return {
        key: endpoint.key,
        label: endpoint.label,
        url: "",
        status: "not checked"
      };
    }

    const validatedStatus = validationStatus(endpoint.key, result, analyses);
    if (validatedStatus) {
      return {
        key: endpoint.key,
        label: endpoint.label,
        url: result.url,
        status: validatedStatus
      };
    }

    return {
      key: endpoint.key,
      label: endpoint.label,
      url: result.url,
      status: result.ok ? `ok ${result.status}` : result.status ? `missing ${result.status}` : `error ${result.error ?? "unknown"}`
    };
  });
}

function validationStatus(key, result, analyses) {
  if (!result?.ok) {
    return "";
  }

  const htmlFallback = looksLikeHtml(result);
  const notMachineReadable = htmlFallback ? `html fallback ${result.status}` : `not validated ${result.status}`;

  if (["openapiWellKnown", "openapiRootJson", "openapiRootYaml"].includes(key)) {
    return analyses.openapi?.source === result.url ? `valid ${result.status}` : notMachineReadable;
  }

  if (["mcp", "mcpServerCard", "agentCard"].includes(key)) {
    return analyses.mcp?.source === result.url ? `valid ${result.status}` : notMachineReadable;
  }

  if (key === "oauth") {
    return analyses.oauth?.authorizationServerMetadata ? `valid ${result.status}` : notMachineReadable;
  }

  if (key === "protectedResource") {
    return analyses.oauth?.protectedResourceMetadata ? `valid ${result.status}` : notMachineReadable;
  }

  if (key === "apiCatalog") {
    return analyses.apiCatalog?.present ? `valid ${result.status}` : notMachineReadable;
  }

  if (key === "aiPlugin") {
    return analyses.aiPlugin?.present ? `valid ${result.status}` : notMachineReadable;
  }

  return "";
}

function looksLikeOpenApi(body = "", headers = {}) {
  const contentType = headers["content-type"] ?? "";
  return /openapi|swagger/i.test(body.slice(0, 5000)) || /json|yaml|yml/i.test(contentType) && /paths\s*[:{]/i.test(body);
}

function looksLikeMachineMetadata(result, keywords) {
  if (!result?.ok || looksLikeHtml(result)) {
    return false;
  }

  const body = result.body ?? "";
  const contentType = result.headers?.["content-type"] ?? "";
  const looksStructured = /json|yaml|yml/i.test(contentType) || /^\s*[{[]/.test(body) || /^[\w-]+\s*:/m.test(body);
  if (!looksStructured) {
    return false;
  }

  return keywords.some((keyword) => new RegExp(escapeRegExp(keyword), "i").test(body));
}

function looksLikeHtml(result) {
  const contentType = result?.headers?.["content-type"] ?? "";
  const bodyStart = String(result?.body ?? "").slice(0, 400).trim();
  return /text\/html/i.test(contentType) || /^<!doctype html/i.test(bodyStart) || /^<html[\s>]/i.test(bodyStart);
}

function countMatches(text, pattern) {
  return [...String(text ?? "").matchAll(pattern)].length;
}

function countWords(text) {
  const matches = String(text ?? "").trim().match(/[A-Za-z0-9][A-Za-z0-9_-]*/g);
  return matches ? matches.length : 0;
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
