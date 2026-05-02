import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "node:http";
import { parseArgs, resolveOptions, runCli } from "../src/cli.mjs";

test("parseArgs accepts config and override flags", () => {
  const parsed = parseArgs(["--config", "mark.config.json", "--profile", "api", "--json", "--out", "report.json"]);
  assert.equal(parsed.configPath, "mark.config.json");
  assert.equal(parsed.profile, "api");
  assert.equal(parsed.format, "json");
  assert.equal(parsed.out, "report.json");
});

test("resolveOptions merges config with CLI overrides", async () => {
  const dir = await mkdtemp(join(tmpdir(), "mark-cli-"));
  await writeFile(join(dir, "mark.config.json"), JSON.stringify({
    target: "https://docs.example.com",
    profile: "docs",
    format: "markdown",
    output: "mark.md",
    failUnder: 70
  }), "utf8");

  const resolved = await resolveOptions(parseArgs(["--profile", "content", "--json"]), dir);
  assert.equal(resolved.target, "https://docs.example.com");
  assert.equal(resolved.profile, "content");
  assert.equal(resolved.format, "json");
  assert.equal(resolved.out, "mark.md");
  assert.equal(resolved.failUnder, 70);
});

test("runCli uses config file and writes JSON report", async () => {
  const dir = await mkdtemp(join(tmpdir(), "mark-cli-"));
  const server = createServer((request, response) => {
    const path = request.url ?? "/";
    if (path === "/") {
      response.writeHead(200, { "content-type": "text/html" });
      response.end('<html><head><script type="application/ld+json">{"@context":"https://schema.org"}</script><link rel="alternate" href="/llms.txt"></head></html>');
      return;
    }
    if (path === "/robots.txt") {
      response.writeHead(200, { "content-type": "text/plain" });
      response.end("User-agent: *\nAllow: /\n");
      return;
    }
    if (path === "/sitemap.xml") {
      response.writeHead(200, { "content-type": "application/xml" });
      response.end("<urlset><url><loc>http://127.0.0.1/docs</loc></url></urlset>");
      return;
    }
    if (path === "/llms.txt") {
      response.writeHead(200, { "content-type": "text/markdown" });
      response.end("# Local Fixture\n> Fixture docs for CLI config testing.\n\n## Docs\n[One](/one)\n[Two](/two)\n[Three](/three)\n[Four](/four)\n[Five](/five)\n");
      return;
    }
    response.writeHead(404, { "content-type": "text/plain" });
    response.end("not found");
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const address = server.address();
    const target = `http://127.0.0.1:${address.port}`;
    await writeFile(join(dir, "mark.config.json"), JSON.stringify({
      target,
      profile: "docs",
      format: "json",
      output: "report.json",
      failUnder: 0,
      timeoutMs: 1000
    }), "utf8");

    const code = await runCli(["--config", "mark.config.json"], {
      cwd: dir,
      stdout: () => {},
      stderr: () => {}
    });
    assert.equal(code, 0);

    const report = JSON.parse(await readFile(join(dir, "report.json"), "utf8"));
    assert.equal(report.product, "MARK");
    assert.equal(report.profile, "docs");
    assert.equal(report.target, target);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
