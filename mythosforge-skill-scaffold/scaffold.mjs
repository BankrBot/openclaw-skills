#!/usr/bin/env node
// mythosforge-skill-scaffold — stamp out a new MythosForge skill on the locked
// universal template (CLI + SKILL.md + AGENTS.md + skill.json + tool-schema.json
// + README.md + LICENSE + .gitignore + package.json). Zero dependencies (Node 18+).
//
// Every generated skill is born cross-agent (Claude Code / Codex / Cursor / any
// tool-use LLM) and BYO-key — identical shape to the reference skill
// `mythosforge-imagegen`, so there is zero template drift across the suite.
//
// Usage:
//   node scaffold.mjs --name mythosforge-video --description "Generate a short video from a prompt." \
//     [--tool-name mythosforge_generate_video] [--env REPLICATE_API_TOKEN] \
//     [--env-link https://replicate.com/account/api-tokens] \
//     [--model-slug black-forest-labs/flux-schnell] [--ext webp] \
//     [--out <parent-dir>] [--force] [--dry-run]
//
// Prints a JSON result line: { ok, name, dir, files }

import { readFile, writeFile, mkdir, readdir, access } from "node:fs/promises";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const TEMPLATE_DIR = join(HERE, "templates");

// template file -> output filename in the new skill
const FILES = {
  "generate.mjs.tmpl": "generate.mjs",
  "SKILL.md.tmpl": "SKILL.md",
  "AGENTS.md.tmpl": "AGENTS.md",
  "skill.json.tmpl": "skill.json",
  "tool-schema.json.tmpl": "tool-schema.json",
  "README.md.tmpl": "README.md",
  "package.json.tmpl": "package.json",
  "LICENSE.tmpl": "LICENSE",
  "gitignore.tmpl": ".gitignore",
  "references_README.md.tmpl": "references/README.md",
};

const fail = (msg) => { console.error(JSON.stringify({ ok: false, error: msg })); process.exit(1); };

function parseArgs(argv) {
  const a = {
    name: "", description: "", toolName: "", env: "REPLICATE_API_TOKEN",
    envLink: "https://replicate.com/account/api-tokens",
    modelSlug: "black-forest-labs/flux-schnell", ext: "webp",
    out: "", force: false, dryRun: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (k === "--force") { a.force = true; continue; }
    if (k === "--dry-run") { a.dryRun = true; continue; }
    if (k === "--help" || k === "-h") { a.help = true; continue; }
    const v = argv[i + 1];
    if (k === "--name") { a.name = v; i++; }
    else if (k === "--description") { a.description = v; i++; }
    else if (k === "--tool-name") { a.toolName = v; i++; }
    else if (k === "--env") { a.env = v; i++; }
    else if (k === "--env-link") { a.envLink = v; i++; }
    else if (k === "--model-slug") { a.modelSlug = v; i++; }
    else if (k === "--ext") { a.ext = v; i++; }
    else if (k === "--out") { a.out = v; i++; }
  }
  return a;
}

const exists = (p) => access(p).then(() => true, () => false);

function tokens(a) {
  // first env var is the primary one referenced in code/docs
  const envList = a.env.split(",").map((s) => s.trim()).filter(Boolean);
  const primaryEnv = envList[0] || "REPLICATE_API_TOKEN";
  const toolName = a.toolName || a.name.replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  return {
    "{{NAME}}": a.name,
    "{{DESCRIPTION}}": a.description,
    "{{TOOL_NAME}}": toolName,
    "{{PRIMARY_ENV}}": primaryEnv,
    "{{ENV_REQUIRED_JSON}}": JSON.stringify(envList),
    "{{ENV_LINK}}": a.envLink,
    "{{MODEL_SLUG}}": a.modelSlug,
    "{{EXT}}": a.ext,
    "{{YEAR}}": String(new Date().getFullYear()),
  };
}

function apply(text, toks) {
  let out = text;
  for (const [k, v] of Object.entries(toks)) out = out.split(k).join(v);
  const leftover = out.match(/\{\{[A-Z_]+\}\}/g);
  if (leftover) throw new Error(`unresolved placeholder(s): ${[...new Set(leftover)].join(", ")}`);
  return out;
}

async function main() {
  const a = parseArgs(process.argv.slice(2));
  if (a.help) {
    console.log('Usage: node scaffold.mjs --name <skill-name> --description "..." [--tool-name x] [--env VAR] [--env-link url] [--model-slug owner/model] [--ext webp] [--out dir] [--force] [--dry-run]');
    return;
  }
  if (!a.name) fail("--name required (e.g. mythosforge-video)");
  if (!/^[a-z0-9][a-z0-9-]*$/.test(a.name)) fail("--name must be kebab-case (lowercase, digits, hyphens)");
  if (!a.description) fail('--description required (one line, e.g. "Generate a short video from a prompt.")');

  const toks = tokens(a);
  const parent = resolve(a.out || join(HERE, ".."));  // default: sibling of the scaffold repo
  const dir = join(parent, a.name);

  // render all files first (fail before writing anything if a placeholder is unresolved)
  const rendered = {};
  for (const [tmpl, outName] of Object.entries(FILES)) {
    const raw = await readFile(join(TEMPLATE_DIR, tmpl), "utf8");
    rendered[outName] = apply(raw, toks);
  }

  if (a.dryRun) {
    console.log(JSON.stringify({ ok: true, dryRun: true, name: a.name, dir, files: Object.keys(rendered) }, null, 2));
    return;
  }

  if (await exists(dir)) {
    const contents = await readdir(dir).catch(() => []);
    if (contents.length && !a.force) fail(`target ${dir} exists and is not empty (use --force to overwrite)`);
  }
  await mkdir(dir, { recursive: true });
  for (const [name, content] of Object.entries(rendered)) {
    const target = join(dir, name);
    await mkdir(dirname(target), { recursive: true });  // handles nested paths e.g. references/README.md
    await writeFile(target, content);
  }

  console.log(JSON.stringify({ ok: true, name: a.name, dir, files: Object.keys(rendered) }));
}

main().catch((err) => fail(err instanceof Error ? err.message : String(err)));
