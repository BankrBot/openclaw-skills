#!/usr/bin/env node
// mythosforge-promptpack — compose a generator-ready prompt from a curated recipe library,
// optionally themed with a brandkit token. NO API key, no network — pure composition.
// The bridge from brandkit -> the generators: pick a recipe, drop in your subject, and (optionally)
// fold in a brandkit.json so the prompt stays on-theme. Feed the result to imagegen/pixelart/etc.
//
// Usage:
//   node promptpack.mjs --list
//   node promptpack.mjs --recipe neon-noir --subject "a lone fox" [--theme brandkit.json] [--out prompt.json]
//   node promptpack.mjs --recipe pixel-sprite --subject "a mushroom" --recipes ./my-recipes.json
//   node promptpack.mjs --schema
//
// Success -> prints { ok, recipe, prompt, model, aspect, negative }. Failure -> { ok:false, error } + exit 1.

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const DEFAULT_RECIPES = join(HERE, "recipes.json");

const RECIPE_SCHEMA = {
  id: "string (kebab id)",
  title: "string",
  model: "flux | retro | nano (suggested generator model)",
  aspect: "square | landscape | portrait",
  template: "prompt template containing the {subject} placeholder",
  negative: "negative-prompt hints",
};

const fail = (msg) => { console.error(JSON.stringify({ ok: false, error: msg })); process.exit(1); };
const str = (x, d = "") => (typeof x === "string" ? x : d);
const strArr = (x) => (Array.isArray(x) ? x.filter((s) => typeof s === "string") : []);

function parseArgs(argv) {
  const a = { list: false, recipe: "", subject: "", theme: "", recipes: "", out: "", schema: false };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (k === "--list") { a.list = true; continue; }
    if (k === "--schema") { a.schema = true; continue; }
    if (k === "--help" || k === "-h") { a.help = true; continue; }
    const v = argv[i + 1];
    if (k === "--recipe") { a.recipe = v; i++; }
    else if (k === "--subject") { a.subject = v; i++; }
    else if (k === "--theme") { a.theme = v; i++; }
    else if (k === "--recipes") { a.recipes = v; i++; }
    else if (k === "--out") { a.out = v; i++; }
  }
  return a;
}

export async function loadRecipes(file) {
  let raw;
  try { raw = JSON.parse(await readFile(file, "utf8")); }
  catch (e) { throw new Error(`could not read recipes ${file}: ${e.message}`); }
  if (!Array.isArray(raw) || !raw.length) throw new Error("recipes file must be a non-empty JSON array");
  return raw;
}

// Pure composition: recipe + subject (+ optional brandkit theme) -> a generator-ready prompt.
export function composePrompt(recipe, subject, theme) {
  const tmpl = str(recipe.template);
  let prompt = tmpl.includes("{subject}") ? tmpl.split("{subject}").join(subject) : `${subject}, ${tmpl}`;
  let negative = str(recipe.negative);
  if (theme && typeof theme === "object") {
    const feel = strArr(theme.feel_words);
    const suffix = str(theme.prompt_suffix);
    const anti = strArr(theme.anti_feel);
    if (feel.length) prompt += `, ${feel.join(", ")}`;
    if (suffix) prompt += `, ${suffix}`;
    if (anti.length) negative = negative ? `${negative}, ${anti.join(", ")}` : anti.join(", ");
  }
  return {
    recipe: str(recipe.id),
    prompt: prompt.trim(),
    model: str(recipe.model, "flux"),
    aspect: str(recipe.aspect, "square"),
    negative: negative.trim(),
  };
}

async function main() {
  const a = parseArgs(process.argv.slice(2));
  if (a.help) {
    console.log('Usage:\n  node promptpack.mjs --list\n  node promptpack.mjs --recipe <id> --subject "..." [--theme brandkit.json] [--recipes file] [--out prompt.json]\n  node promptpack.mjs --schema');
    return;
  }
  if (a.schema) { console.log(JSON.stringify(RECIPE_SCHEMA, null, 2)); return; }

  let recipes;
  try { recipes = await loadRecipes(a.recipes ? resolve(a.recipes) : DEFAULT_RECIPES); }
  catch (e) { fail(e.message); }

  if (a.list) {
    console.log(JSON.stringify({ ok: true, count: recipes.length,
      recipes: recipes.map((r) => ({ id: str(r.id), title: str(r.title), model: str(r.model), aspect: str(r.aspect) })) }, null, 2));
    return;
  }

  if (!a.recipe) fail(`--recipe <id> required (see --list). available: ${recipes.map((r) => r.id).join(", ")}`);
  if (!a.subject) fail('--subject "..." required (what to put into the recipe)');
  const recipe = recipes.find((r) => r.id === a.recipe);
  if (!recipe) fail(`unknown recipe '${a.recipe}' (see --list). available: ${recipes.map((r) => r.id).join(", ")}`);

  let theme = null;
  if (a.theme) {
    try { theme = JSON.parse(await readFile(resolve(a.theme), "utf8")); }
    catch (e) { fail(`could not read --theme: ${e.message}`); }
  }

  const composed = composePrompt(recipe, a.subject.trim(), theme);
  const result = { ok: true, ...composed };
  if (a.out) {
    const out = resolve(a.out);
    await mkdir(dirname(out), { recursive: true });
    await writeFile(out, JSON.stringify(result, null, 2));
    result.path = out;
  }
  console.log(JSON.stringify(result));
}

if (pathToFileURL(process.argv[1] || "").href === import.meta.url) {
  main().catch((err) => fail(err instanceof Error ? err.message : String(err)));
}
