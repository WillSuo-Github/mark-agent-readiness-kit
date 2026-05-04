const textarea = document.querySelector("#report-json");
const loadDemoButton = document.querySelector("#load-demo");
const scoreEl = document.querySelector("#score");
const gradeEl = document.querySelector("#grade");
const summaryEl = document.querySelector("#summary");
const categoriesEl = document.querySelector("#categories");
const recommendationsEl = document.querySelector("#recommendations");
const evidenceEl = document.querySelector("#evidence");

const categoryLabels = {
  discoverability: "Discoverability",
  agentContent: "Agent-readable content",
  capabilities: "Capabilities",
  trustAndAuth: "Trust and auth"
};

const demoReport = {
  product: "MARK",
  version: "0.1.0",
  auditedAt: "2026-05-02T00:00:00.000Z",
  target: "https://example.dev",
  score: 68,
  grade: "C",
  profile: "docs",
  categoryScores: {
    discoverability: 27,
    agentContent: 20,
    capabilities: 6,
    trustAndAuth: 15
  },
  categoryMaxScores: {
    discoverability: 35,
    agentContent: 35,
    capabilities: 10,
    trustAndAuth: 20
  },
  summary: "Partial readiness. Agents can discover some context, but agent-readable content will limit reliable use.",
  recommendations: [
    "Improve /llms.txt structure with a clear H1, one-paragraph summary, sections, and high-signal links.",
    "Publish OpenAPI at a stable well-known or root URL, link it from docs/homepage, and include it in /llms.txt as backup discovery.",
    "Publish MCP-style or agent metadata at a stable .well-known path, link it from docs/homepage, and include it in /llms.txt as backup discovery."
  ],
  evidence: [
    { label: "robots.txt", status: "ok 200", url: "https://example.dev/robots.txt" },
    { label: "sitemap.xml", status: "ok 200", url: "https://example.dev/sitemap.xml" },
    { label: "llms.txt", status: "ok 200", url: "https://example.dev/llms.txt" },
    { label: "OpenAPI well-known JSON", status: "missing 404", url: "https://example.dev/.well-known/openapi.json" },
    { label: "MCP well-known manifest", status: "missing 404", url: "https://example.dev/.well-known/mcp.json" },
    { label: "OAuth authorization server metadata", status: "ok 200", url: "https://example.dev/.well-known/oauth-authorization-server" }
  ]
};

loadDemoButton.addEventListener("click", () => {
  textarea.value = JSON.stringify(demoReport, null, 2);
  renderReport(demoReport);
});

textarea.addEventListener("input", () => {
  const value = textarea.value.trim();
  if (!value) {
    renderEmpty();
    return;
  }

  try {
    renderReport(JSON.parse(value));
  } catch {
    summaryEl.textContent = "JSON is not valid yet.";
  }
});

function renderReport(report) {
  scoreEl.textContent = `${Number(report.score ?? 0)}/100`;
  gradeEl.textContent = report.grade ?? "--";
  summaryEl.textContent = report.summary ?? "No summary provided.";
  renderCategories(report.categoryScores ?? {}, report.categoryMaxScores ?? {});
  renderRecommendations(report.recommendations ?? []);
  renderEvidence(report.evidence ?? []);
}

function renderEmpty() {
  scoreEl.textContent = "--";
  gradeEl.textContent = "--";
  summaryEl.textContent = "Run the CLI and paste the JSON report here, or load the demo to inspect the output shape.";
  categoriesEl.innerHTML = "";
  recommendationsEl.innerHTML = "";
  evidenceEl.innerHTML = "";
}

function renderCategories(scores, maxScores) {
  categoriesEl.innerHTML = "";
  for (const [key, label] of Object.entries(categoryLabels)) {
    const max = Number(maxScores[key] ?? defaultMax(key));
    const value = Number(scores[key] ?? 0);
    const pct = Math.max(0, Math.min(100, Math.round(value / max * 100)));
    const row = document.createElement("div");
    row.className = "category";
    const tone = pct >= 70 ? "" : pct >= 45 ? "medium" : "low";
    row.innerHTML = `
      <div class="category-head">
        <span>${label}</span>
        <span>${value}/${max}</span>
      </div>
      <div class="bar" aria-label="${label} score">
        <span class="${tone}" style="width:${pct}%"></span>
      </div>
    `;
    categoriesEl.append(row);
  }
}

function defaultMax(key) {
  return {
    discoverability: 30,
    agentContent: 25,
    capabilities: 25,
    trustAndAuth: 20
  }[key] ?? 100;
}

if (new URLSearchParams(window.location.search).get("demo") === "1") {
  textarea.value = JSON.stringify(demoReport, null, 2);
  renderReport(demoReport);
} else {
  renderEmpty();
}

function renderRecommendations(items) {
  recommendationsEl.innerHTML = "";
  if (!items.length) {
    const li = document.createElement("li");
    li.textContent = "No deterministic gaps detected.";
    recommendationsEl.append(li);
    return;
  }

  for (const item of items) {
    const li = document.createElement("li");
    li.textContent = item;
    recommendationsEl.append(li);
  }
}

function renderEvidence(items) {
  evidenceEl.innerHTML = "";
  for (const item of items) {
    const tr = document.createElement("tr");
    const label = document.createElement("td");
    const status = document.createElement("td");
    const url = document.createElement("td");
    label.textContent = item.label ?? item.key ?? "Signal";
    status.textContent = item.status ?? "unknown";
    url.textContent = item.url ?? "";
    tr.append(label, status, url);
    evidenceEl.append(tr);
  }
}
