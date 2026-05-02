#!/usr/bin/env node
import { mkdir, copyFile, readFile, rm, stat } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const manifestPath = join(root, "release/standalone-repo-manifest.txt");
const outDir = join(root, "artifacts/standalone-release");

const manifest = (await readFile(manifestPath, "utf8"))
  .split("\n")
  .map((line) => line.trim())
  .filter(Boolean);

await rm(outDir, { recursive: true, force: true });
await mkdir(outDir, { recursive: true });

for (const relativePath of manifest) {
  const source = join(root, relativePath);
  const destination = join(outDir, relativePath);
  const sourceStat = await stat(source);
  if (!sourceStat.isFile()) {
    throw new Error(`Manifest entry is not a file: ${relativePath}`);
  }
  await mkdir(dirname(destination), { recursive: true });
  await copyFile(source, destination);
}

console.log(`Exported ${manifest.length} files to ${outDir}`);
