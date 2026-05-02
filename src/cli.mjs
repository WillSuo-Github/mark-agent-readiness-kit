import { access, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { auditTarget, generateMarkdownReport } from "./audit.mjs";

const DEFAULT_CONFIG_FILES = ["mark.config.json", ".markrc.json"];
const VALID_FORMATS = new Set(["json", "markdown"]);

export function usage() {
  return `Usage:
  mark-audit <url-or-hostname> [--profile api|docs|content] [--json] [--markdown] [--out report.md|report.json] [--fail-under 70]
  mark-audit --config mark.config.json

Examples:
  npm run audit -- https://example.com --profile api
  npm run audit -- docs.example.com --profile docs --json --out report.json
  npm run audit -- --config mark.config.json
`;
}

export function parseArgs(rawArgs) {
  const options = {
    format: undefined,
    out: undefined,
    failUnder: undefined,
    profile: undefined,
    timeoutMs: undefined,
    configPath: undefined,
    target: undefined,
    help: false
  };

  for (let index = 0; index < rawArgs.length; index += 1) {
    const arg = rawArgs[index];
    if (arg === "--json") {
      options.format = "json";
    } else if (arg === "--markdown") {
      options.format = "markdown";
    } else if (arg === "--out") {
      options.out = requireValue(rawArgs, index, "--out");
      index += 1;
    } else if (arg === "--profile") {
      options.profile = requireValue(rawArgs, index, "--profile");
      index += 1;
    } else if (arg === "--config") {
      options.configPath = requireValue(rawArgs, index, "--config");
      index += 1;
    } else if (arg === "--timeout-ms") {
      options.timeoutMs = parseNumber(requireValue(rawArgs, index, "--timeout-ms"), "--timeout-ms");
      index += 1;
    } else if (arg === "--fail-under") {
      options.failUnder = parseNumber(requireValue(rawArgs, index, "--fail-under"), "--fail-under");
      index += 1;
    } else if (arg === "--help" || arg === "-h") {
      options.help = true;
    } else if (!options.target) {
      options.target = arg;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return options;
}

export async function resolveOptions(parsed, cwd = process.cwd()) {
  const configPath = parsed.configPath ?? await findDefaultConfig(cwd);
  const config = configPath ? await loadConfig(configPath, cwd) : {};
  const format = parsed.format ?? config.format ?? "markdown";

  if (!VALID_FORMATS.has(format)) {
    throw new Error(`Invalid format: ${format}. Expected json or markdown.`);
  }

  return {
    target: parsed.target ?? config.target,
    profile: parsed.profile ?? config.profile ?? "api",
    format,
    out: parsed.out ?? config.output ?? config.out ?? "",
    failUnder: parsed.failUnder ?? config.failUnder ?? null,
    timeoutMs: parsed.timeoutMs ?? config.timeoutMs ?? undefined,
    configPath
  };
}

export async function runCli(rawArgs, io = {}) {
  const stdout = io.stdout ?? ((message) => console.log(message));
  const stderr = io.stderr ?? ((message) => console.error(message));
  const parsed = parseArgs(rawArgs);

  if (parsed.help) {
    stdout(usage());
    return 0;
  }

  const options = await resolveOptions(parsed, io.cwd ?? process.cwd());
  if (!options.target) {
    stdout(usage());
    return 0;
  }

  const audit = await auditTarget(options.target, {
    profile: options.profile,
    timeoutMs: options.timeoutMs
  });
  const output = options.format === "json" ? JSON.stringify(audit, null, 2) : generateMarkdownReport(audit);

  if (options.out) {
    await writeFile(resolve(io.cwd ?? process.cwd(), options.out), `${output}\n`, "utf8");
  } else {
    stdout(output);
  }

  if (options.failUnder !== null && audit.score < options.failUnder) {
    stderr(`MARK score ${audit.score} is below threshold ${options.failUnder}.`);
    return 2;
  }

  return 0;
}

export async function loadConfig(configPath, cwd = process.cwd()) {
  const resolved = resolve(cwd, configPath);
  let parsed;
  try {
    parsed = JSON.parse(await readFile(resolved, "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") {
      throw new Error(`Config file not found: ${configPath}`);
    }
    throw new Error(`Could not read config file ${configPath}: ${error?.message ?? error}`);
  }

  validateConfig(parsed, configPath);
  return parsed;
}

export async function findDefaultConfig(cwd = process.cwd()) {
  for (const filename of DEFAULT_CONFIG_FILES) {
    const candidate = resolve(cwd, filename);
    try {
      await access(candidate);
      return candidate;
    } catch {
      // Keep looking for the next default config name.
    }
  }

  return "";
}

function validateConfig(config, configPath) {
  if (!config || typeof config !== "object" || Array.isArray(config)) {
    throw new Error(`Config file ${configPath} must contain a JSON object.`);
  }

  const allowed = new Set(["target", "profile", "format", "output", "out", "failUnder", "timeoutMs"]);
  for (const key of Object.keys(config)) {
    if (!allowed.has(key)) {
      throw new Error(`Unknown config key "${key}" in ${configPath}.`);
    }
  }

  if (config.format !== undefined && !VALID_FORMATS.has(config.format)) {
    throw new Error(`Invalid config format "${config.format}". Expected json or markdown.`);
  }

  for (const numericKey of ["failUnder", "timeoutMs"]) {
    if (config[numericKey] !== undefined && !Number.isFinite(Number(config[numericKey]))) {
      throw new Error(`Config key "${numericKey}" must be numeric.`);
    }
  }
}

function requireValue(args, index, flag) {
  const value = args[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`${flag} requires a value.`);
  }
  return value;
}

function parseNumber(value, flag) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`${flag} requires a number.`);
  }
  return parsed;
}
