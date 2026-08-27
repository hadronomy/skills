#!/usr/bin/env node
// Keeps .claude-plugin/plugin.json's version equal to package.json's.
// Changesets bumps package.json; the plugin manifest has no idea that happened,
// and a stale version there means subscribers never see the update.
//
//   node scripts/sync-plugin-version.mjs           write
//   node scripts/sync-plugin-version.mjs --check   exit 1 on drift (CI)

import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const checkOnly = process.argv.includes("--check");

const pkgPath = join(REPO, "package.json");
const pluginPath = join(REPO, ".claude-plugin", "plugin.json");

const version = JSON.parse(readFileSync(pkgPath, "utf8")).version;
const raw = readFileSync(pluginPath, "utf8");
const plugin = JSON.parse(raw);

if (plugin.version === version) {
  console.log(`ok - plugin.json already at ${version}`);
  process.exit(0);
}

if (checkOnly) {
  console.error(`plugin.json is ${plugin.version}, package.json is ${version}`);
  console.error("run: npm run version");
  process.exit(1);
}

// Rewrite the one line rather than re-serialising, so key order and formatting
// survive untouched.
writeFileSync(pluginPath, raw.replace(/("version":\s*)"[^"]*"/, `$1"${version}"`));
console.log(`plugin.json ${plugin.version} -> ${version}`);
