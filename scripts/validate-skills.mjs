#!/usr/bin/env node
// Validates every skill against the Agent Skills spec and this repo's own
// conventions. Run it before finishing any change; CI runs the same file.
//
// Checks, in order of how often they catch something:
//   frontmatter fields and their spec limits
//   name matches the directory name
//   relative links resolve, and stay one level deep
//   SKILL.md body budget
//   agents/openai.yaml present and its policy matches the frontmatter
//   plugin.json lists exactly the promoted skills
//   promoted skills have a docs page

import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PROMOTED = ["engineering", "productivity"];
const BUCKETS = [...PROMOTED, "misc", "in-progress", "deprecated"];
const MAX_BODY_LINES = 500;

const problems = [];
const fail = (where, message) => problems.push({ where, message });

/** Minimal YAML frontmatter reader. The spec allows only scalars and one
 *  string→string map, so a full parser would be more surface than value. */
function readFrontmatter(text, where) {
  if (!text.startsWith("---\n")) {
    fail(where, "missing YAML frontmatter");
    return null;
  }
  const end = text.indexOf("\n---", 4);
  if (end === -1) {
    fail(where, "frontmatter is never closed");
    return null;
  }
  const block = text.slice(4, end);
  const out = {};
  let currentMap = null;
  for (const line of block.split("\n")) {
    if (!line.trim() || line.trimStart().startsWith("#")) continue;
    if (/^\s+\S/.test(line) && currentMap) {
      const [k, ...rest] = line.trim().split(":");
      out[currentMap][k.trim()] = rest.join(":").trim();
      continue;
    }
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    if (value === "") { currentMap = key; out[key] = {}; }
    else { currentMap = null; out[key] = value.replace(/^["']|["']$/g, ""); }
  }
  return { data: out, bodyOffset: text.slice(0, end).split("\n").length + 1 };
}

function findSkills() {
  const found = [];
  for (const bucket of BUCKETS) {
    const dir = join(REPO, "skills", bucket);
    if (!existsSync(dir)) continue;
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      if (!statSync(path).isDirectory()) continue;
      if (!existsSync(join(path, "SKILL.md"))) {
        fail(`skills/${bucket}/${name}`, "directory has no SKILL.md");
        continue;
      }
      found.push({ bucket, name, path, promoted: PROMOTED.includes(bucket) });
    }
  }
  return found;
}

function checkName(name, where) {
  if (name.length < 1 || name.length > 64) fail(where, "name must be 1-64 characters");
  if (!/^[a-z0-9-]+$/.test(name)) fail(where, `name "${name}" allows only a-z, 0-9 and hyphens`);
  if (name.startsWith("-") || name.endsWith("-")) fail(where, `name "${name}" must not start or end with a hyphen`);
  if (name.includes("--")) fail(where, `name "${name}" must not contain consecutive hyphens`);
}

function checkLinks(skill) {
  const files = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir)) {
      const p = join(dir, entry);
      if (statSync(p).isDirectory()) walk(p);
      else if (p.endsWith(".md")) files.push(p);
    }
  };
  walk(skill.path);

  for (const file of files) {
    const rel = relative(REPO, file);
    const text = readFileSync(file, "utf8");
    for (const m of text.matchAll(/\]\(([^)\s]+\.md)(#[^)]*)?\)/g)) {
      const target = m[1];
      if (/^[a-z]+:\/\//.test(target)) continue;
      const abs = resolve(dirname(file), target);
      if (!existsSync(abs)) fail(rel, `broken link -> ${target}`);
      // The spec asks for references one level deep from SKILL.md. Two or more
      // hops means the agent has to chain loads to reach the material.
      if (file.endsWith("SKILL.md") && target.split("/").length > 2) {
        fail(rel, `link is more than one level deep -> ${target}`);
      }
    }
  }
}

const skills = findSkills();
if (skills.length === 0) fail("skills/", "no skills found");

for (const skill of skills) {
  const where = `skills/${skill.bucket}/${skill.name}/SKILL.md`;
  const text = readFileSync(join(skill.path, "SKILL.md"), "utf8");
  const parsed = readFrontmatter(text, where);
  if (!parsed) continue;
  const { data, bodyOffset } = parsed;

  if (!data.name) fail(where, "frontmatter is missing `name`");
  else {
    checkName(data.name, where);
    if (data.name !== skill.name) fail(where, `name "${data.name}" must match directory "${skill.name}"`);
  }

  if (!data.description) fail(where, "frontmatter is missing `description`");
  else if (data.description.length > 1024) fail(where, `description is ${data.description.length} chars; the limit is 1024`);

  if (data.compatibility && data.compatibility.length > 500) {
    fail(where, `compatibility is ${data.compatibility.length} chars; the limit is 500`);
  }

  const bodyLines = text.split("\n").length - bodyOffset;
  if (bodyLines > MAX_BODY_LINES) {
    fail(where, `body is ${bodyLines} lines; keep it under ${MAX_BODY_LINES} and push detail into references/`);
  }

  const yamlPath = join(skill.path, "agents", "openai.yaml");
  if (skill.promoted && !existsSync(yamlPath)) {
    fail(`skills/${skill.bucket}/${skill.name}`, "promoted skill has no agents/openai.yaml");
  }
  if (existsSync(yamlPath)) {
    const yaml = readFileSync(yamlPath, "utf8");
    const userInvokedHere = data["disable-model-invocation"] === "true";
    const userInvokedThere = /allow_implicit_invocation:\s*false/.test(yaml);
    if (userInvokedHere !== userInvokedThere) {
      fail(`skills/${skill.bucket}/${skill.name}`,
        "invocation mode disagrees between SKILL.md and agents/openai.yaml");
    }
  }

  if (skill.promoted && !existsSync(join(REPO, "docs", skill.bucket, `${skill.name}.md`))) {
    fail(`docs/${skill.bucket}/${skill.name}.md`, "promoted skill has no docs page");
  }

  checkLinks(skill);
}

// The plugin ships exactly the promoted set. Drift here means a skill was
// promoted or demoted without updating the manifest.
const plugin = JSON.parse(readFileSync(join(REPO, ".claude-plugin", "plugin.json"), "utf8"));
const listed = new Set(plugin.skills ?? []);
const expected = new Set(skills.filter((s) => s.promoted).map((s) => `./skills/${s.bucket}/${s.name}`));
for (const path of expected) if (!listed.has(path)) fail(".claude-plugin/plugin.json", `missing ${path}`);
for (const path of listed) {
  if (!expected.has(path)) fail(".claude-plugin/plugin.json", `lists ${path}, which is not a promoted skill`);
  if (!existsSync(join(REPO, path))) fail(".claude-plugin/plugin.json", `lists ${path}, which does not exist`);
}

if (problems.length > 0) {
  console.error(`\n${problems.length} problem${problems.length === 1 ? "" : "s"}:\n`);
  for (const { where, message } of problems) console.error(`  ${where}\n    ${message}`);
  console.error("");
  process.exit(1);
}

console.log(`ok - ${skills.length} skill${skills.length === 1 ? "" : "s"} validated`);
