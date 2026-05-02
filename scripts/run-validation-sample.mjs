#!/usr/bin/env node
import { mkdir, writeFile } from "node:fs/promises";
import { auditTarget, generateMarkdownReport } from "../src/audit.mjs";

const targets = [
  "https://docs.anthropic.com",
  "https://platform.openai.com/docs",
  "https://docs.github.com",
  "https://docs.stripe.com",
  "https://supabase.com/docs",
  "https://vercel.com/docs",
  "https://developers.cloudflare.com",
  "https://docs.cursor.com",
  "https://docs.linear.app",
  "https://docs.firecrawl.dev"
];

const outDir = new URL("../samples/validation/", import.meta.url);
await mkdir(outDir, { recursive: true });

const rows = [];
const findingCounts = new Map();

for (const target of targets) {
  const audit = await auditTarget(target, { timeoutMs: 5000, profile: "docs" });
  const slug = new URL(target).hostname.replace(/^www\./, "").replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  await writeFile(new URL(`${slug}.json`, outDir), `${JSON.stringify(audit, null, 2)}\n`, "utf8");
  await writeFile(new URL(`${slug}.md`, outDir), `${generateMarkdownReport(audit)}\n`, "utf8");

  for (const finding of audit.findings) {
    findingCounts.set(finding.key, (findingCounts.get(finding.key) ?? 0) + 1);
  }

  rows.push({
    target: audit.target,
    score: audit.score,
    grade: audit.grade,
    weakest: weakestCategory(audit.categoryScores),
    topFinding: audit.findings[0]?.title ?? "No finding"
  });
}

const commonFindings = [...findingCounts.entries()]
  .sort((a, b) => b[1] - a[1])
  .map(([key, count]) => `- ${key}: ${count}/${targets.length}`)
  .join("\n");

const table = rows
  .map((row) => `| ${row.target} | ${row.score} | ${row.grade} | ${row.weakest} | ${row.topFinding} |`)
  .join("\n");

const summary = `# MARK Validation Sample

Generated: ${new Date().toISOString()}

This is an internal sample run across public devtool/API documentation surfaces. It is not customer feedback and should not be presented as traction.

| Target | Score | Grade | Weakest category | Top finding |
| --- | ---: | --- | --- | --- |
${table}

## Common Findings

${commonFindings || "- No repeated findings."}

## Interpretation

- Use this sample to find repeated scoring issues before public teardown work.
- Treat high scores and low scores as hypotheses, not proof of market demand.
- Public publishing of any teardown remains approval-gated.
`;

await writeFile(new URL("summary.md", outDir), summary, "utf8");

console.log(summary);

function weakestCategory(scores) {
  return Object.entries(scores ?? {})
    .sort((a, b) => a[1] - b[1])[0]?.[0] ?? "unknown";
}
