#!/usr/bin/env node
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { spawn } from "node:child_process";

const chromePath = process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const outDir = new URL("../artifacts/ui-qa/", import.meta.url);
const pageUrl = new URL("../site/index.html?demo=1", import.meta.url).href;

await mkdir(outDir, { recursive: true });

const userDataDir = await mkdtemp(join(tmpdir(), "mark-chrome-"));
const port = 9223 + Math.floor(Math.random() * 1000);
const chrome = spawn(chromePath, [
  "--headless=new",
  "--disable-gpu",
  "--hide-scrollbars",
  "--no-first-run",
  "--no-default-browser-check",
  `--remote-debugging-port=${port}`,
  `--user-data-dir=${userDataDir}`,
  "about:blank"
], {
  stdio: "ignore"
});

try {
  await waitForChrome(port);
  const desktop = await captureViewport(port, {
    name: "desktop",
    width: 1440,
    height: 1100,
    mobile: false
  });
  const mobile = await captureViewport(port, {
    name: "mobile",
    width: 390,
    height: 900,
    mobile: true
  });

  const summary = { pageUrl, checks: [desktop.check, mobile.check] };
  await writeFile(new URL("summary.json", outDir), `${JSON.stringify(summary, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(summary, null, 2));

  const failed = summary.checks.filter((check) => !check.noHorizontalOverflow || !check.demoLoaded);
  if (failed.length > 0) {
    process.exitCode = 1;
  }
} finally {
  chrome.kill();
}

async function captureViewport(port, viewport) {
  const target = await createTarget(port);
  const client = await connectCdp(target.webSocketDebuggerUrl);

  await client.send("Page.enable");
  await client.send("Runtime.enable");
  await client.send("Emulation.setDeviceMetricsOverride", {
    width: viewport.width,
    height: viewport.height,
    deviceScaleFactor: 1,
    mobile: viewport.mobile
  });
  await client.send("Page.navigate", { url: pageUrl });
  await client.waitFor("Page.loadEventFired");
  await client.send("Runtime.evaluate", {
    expression: "new Promise((resolve) => setTimeout(resolve, 250))",
    awaitPromise: true
  });

  const metrics = await client.send("Runtime.evaluate", {
    expression: `JSON.stringify({
      innerWidth: window.innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
      bodyScrollWidth: document.body.scrollWidth,
      score: document.querySelector('#score')?.textContent,
      grade: document.querySelector('#grade')?.textContent
    })`,
    returnByValue: true
  });
  const parsedMetrics = JSON.parse(metrics.result.value);
  const screenshot = await client.send("Page.captureScreenshot", {
    format: "png",
    captureBeyondViewport: false
  });
  const filename = `mark-${viewport.name}.png`;
  await writeFile(new URL(filename, outDir), Buffer.from(screenshot.data, "base64"));
  await client.close();

  return {
    screenshot: filename,
    check: {
      viewport: viewport.name,
      width: viewport.width,
      height: viewport.height,
      screenshot: pathToFileURL(new URL(filename, outDir).pathname).pathname,
      innerWidth: parsedMetrics.innerWidth,
      scrollWidth: parsedMetrics.scrollWidth,
      bodyScrollWidth: parsedMetrics.bodyScrollWidth,
      noHorizontalOverflow: Math.max(parsedMetrics.scrollWidth, parsedMetrics.bodyScrollWidth) <= parsedMetrics.innerWidth + 1,
      demoLoaded: parsedMetrics.score === "68/100" && parsedMetrics.grade === "C"
    }
  };
}

async function waitForChrome(port) {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/version`);
      if (response.ok) {
        return;
      }
    } catch {
      // Chrome is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("Chrome DevTools endpoint did not start.");
}

async function createTarget(port) {
  const response = await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, {
    method: "PUT"
  });
  if (!response.ok) {
    throw new Error(`Could not create Chrome target: ${response.status}`);
  }
  return response.json();
}

async function connectCdp(url) {
  const socket = new WebSocket(url);
  const pending = new Map();
  const events = new Map();
  let nextId = 1;

  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      const { resolve, reject } = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) {
        reject(new Error(message.error.message));
      } else {
        resolve(message.result ?? {});
      }
      return;
    }

    if (message.method && events.has(message.method)) {
      for (const resolve of events.get(message.method)) {
        resolve(message.params ?? {});
      }
      events.delete(message.method);
    }
  });

  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });

  return {
    send(method, params = {}) {
      const id = nextId++;
      socket.send(JSON.stringify({ id, method, params }));
      return new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject });
      });
    },
    waitFor(method) {
      return new Promise((resolve) => {
        const list = events.get(method) ?? [];
        list.push(resolve);
        events.set(method, list);
      });
    },
    close() {
      socket.close();
    }
  };
}
