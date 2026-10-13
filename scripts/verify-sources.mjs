#!/usr/bin/env node
/*
  Regression check for the registered ThreeUI Kage source: every file and binary asset must match the
  size and SHA-256 recorded in scripts/source-manifest.json. Runs before `dev` and `build`.
*/
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const manifest = JSON.parse(readFileSync(join(root, "scripts", "source-manifest.json"), "utf8"));

const problems = [];
for (const entry of manifest.files) {
  const location = entry.localPath ?? entry.path;
  const file = join(root, ...location.split("/"));
  if (!existsSync(file)) {
    problems.push(`missing   ${location}`);
    continue;
  }
  const bytes = readFileSync(file);
  const sha = createHash("sha256").update(bytes).digest("hex");
  if (bytes.length !== entry.bytes) problems.push(`size      ${location}: ${bytes.length} bytes, expected ${entry.bytes}`);
  else if (sha !== entry.sha256) problems.push(`hash      ${location}: ${sha}, expected ${entry.sha256}`);
}
for (const location of manifest.authored) {
  if (!existsSync(join(root, ...location.split("/")))) problems.push(`missing   ${location} (authored; rebuild it with scripts/build-wordmark-font.py)`);
}

if (problems.length) {
  console.error(`verify-sources: ${problems.length} problem(s)\n  ${problems.join("\n  ")}`);
  process.exit(1);
}
console.log(`verify-sources: ${manifest.files.length} registered files match their SHA-256`);
