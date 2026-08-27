#!/usr/bin/env node
// Rebuilds every globally-installed skill on a new machine.
//
// The `skills` CLI keeps two locks and can only restore one of them:
//
//   project   skills-lock.json in cwd    `skills experimental_install`
//   global    ~/.agents/.skill-lock.json  no restore command exists
//
// Everything installed with `--global` therefore has no reproducible path back.
// This script closes that: it reads the global lock, groups the skills by
// source, and replays them as `skills add` calls.
//
// The lock records no agent list, so the target agents come from --agent
// (default: the three this setup uses).
//
//   node scripts/restore-global-skills.mjs            print the commands
//   node scripts/restore-global-skills.mjs --run      execute them
//   node scripts/restore-global-skills.mjs --export   write global-skills.json
//   node scripts/restore-global-skills.mjs --from global-skills.json --run
//
// Export the manifest and commit it. The lock is machine state; the manifest is
// the intent, and it survives a lock format change.

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { homedir } from "node:os";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const has = (flag) => argv.includes(flag);
const valueOf = (flag, fallback) => {
  const i = argv.indexOf(flag);
  return i !== -1 && argv[i + 1] ? argv[i + 1] : fallback;
};

const MANIFEST = join(REPO, "global-skills.json");
const agents = valueOf("--agent", "claude-code,codex,opencode").split(",");

// Mirrors the CLI's own getSkillLockPath(): XDG_STATE_HOME wins, else ~/.agents.
function globalLockPath() {
  const xdg = process.env.XDG_STATE_HOME;
  return xdg ? join(xdg, "skills", ".skill-lock.json") : join(homedir(), ".agents", ".skill-lock.json");
}

/** source -> { sourceUrl, skills: [name] } */
function groupBySource(entries) {
  const bySource = new Map();
  for (const [name, entry] of entries) {
    const source = entry.source ?? entry.sourceUrl;
    if (!source) {
      console.error(`skipping ${name}: no source recorded`);
      continue;
    }
    if (!bySource.has(source)) bySource.set(source, { sourceUrl: entry.sourceUrl, skills: [] });
    bySource.get(source).skills.push(name);
  }
  for (const group of bySource.values()) group.skills.sort();
  return bySource;
}

function load() {
  const from = valueOf("--from", null);
  if (from || (!has("--export") && existsSync(MANIFEST) && !has("--lock"))) {
    const path = from ?? MANIFEST;
    const manifest = JSON.parse(readFileSync(path, "utf8"));
    const bySource = new Map(Object.entries(manifest.sources));
    return { bySource, origin: path };
  }
  const lockPath = globalLockPath();
  if (!existsSync(lockPath)) {
    console.error(`no global lock at ${lockPath}`);
    process.exit(1);
  }
  const lock = JSON.parse(readFileSync(lockPath, "utf8"));
  return { bySource: groupBySource(Object.entries(lock.skills ?? {})), origin: lockPath };
}

const { bySource, origin } = load();
const total = [...bySource.values()].reduce((n, g) => n + g.skills.length, 0);

if (has("--export")) {
  const sources = Object.fromEntries(
    [...bySource.entries()].sort(([a], [b]) => a.localeCompare(b))
  );
  writeFileSync(
    MANIFEST,
    JSON.stringify({ version: 1, agents, sources }, null, 2) + "\n"
  );
  console.log(`wrote global-skills.json - ${total} skills across ${bySource.size} sources`);
  process.exit(0);
}

console.log(`# ${total} skills from ${bySource.size} sources, read from ${origin}`);
console.log(`# agents: ${agents.join(", ")}\n`);

let failed = 0;
for (const [source, { skills }] of bySource) {
  const args = [
    "skills@latest", "add", source,
    "--global", "-y",
    "--skill", skills.join(","),
    ...agents.flatMap((a) => ["--agent", a]),
  ];
  const command = `npx ${args.join(" ")}`;

  if (!has("--run")) { console.log(command); continue; }

  console.log(`\n$ ${command}`);
  const result = spawnSync("npx", args, { stdio: "inherit" });
  if (result.status !== 0) { failed += 1; console.error(`failed: ${source}`); }
}

if (!has("--run")) {
  console.log("\n# re-run with --run to execute");
} else if (failed > 0) {
  console.error(`\n${failed} source(s) failed`);
  process.exit(1);
} else {
  console.log(`\nrestored ${total} skills`);
}
