#!/usr/bin/env node
// mythosforge-brandkit — extract or author a reusable brand/style token (brandkit.json).
// The DIRECT layer: one token feeds every generator's prompt + lookgate's palette check, so a
// user's outputs share ONE consistent visual identity. Read references/brandkit-schema.md.
//
// Two modes:
//   extract (vision): GEMINI_API_KEY=... node brandkit.mjs --from ref.png [--name my-theme] [--out brandkit.json]
//   author (no key):  node brandkit.mjs --author [--in partial.json] [--name my-theme] [--out brandkit.json]
//
// Default vision provider = Google Gemini via its OpenAI-compatible layer; override
// --base-url/--model for any other OpenAI-compatible vision endpoint. Zero deps (Node 18+ fetch).
//
// Success -> prints the style token JSON. Failure -> { "ok": false, "error": "..." } + exit 1.

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve, extname } from "node:path";
import { pathToFileURL } from "node:url";

// The style-token schema (shiro's references/brandkit-schema.md).
const TOKEN_SCHEMA = {
  name: "string (kebab id)",
  north_star: "one-line visual thesis",
  palette: {
    base: ["#hex background/base colors"],
    accent_primary: "#hex",
    accent_highlight: "#hex",
    accents_allowed: ["#hex allowed per-asset accents"],
    rule: "one-line palette rule (what's allowed / forbidden)",
  },
  typography: { display: "font", body: "font", mono: "font" },
  feel_words: ["adjectives the look should hit"],
  anti_feel: ["adjectives to avoid (doubles as negative prompt)"],
  lighting: "one-line lighting direction",
  emblem_refs: ["./logo.png"],
  prompt_suffix: "phrase appended to every generator prompt to stay on-theme",
};

const MIME = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".gif": "image/gif" };
const fail = (msg) => { console.error(JSON.stringify({ ok: false, error: msg })); process.exit(1); };

function parseArgs(argv) {
  const a = { from: "", author: false, in: "", name: "", out: "brandkit.json",
    model: process.env.BRANDKIT_MODEL || "gemini-3.5-flash",
    baseUrl: process.env.BRANDKIT_BASE_URL || "https://generativelanguage.googleapis.com/v1beta/openai",
    auth: "bearer", dryRun: false, schema: false };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (k === "--author") { a.author = true; continue; }
    if (k === "--dry-run") { a.dryRun = true; continue; }
    if (k === "--schema") { a.schema = true; continue; }
    if (k === "--help" || k === "-h") { a.help = true; continue; }
    const v = argv[i + 1];
    if (k === "--from") { a.from = v; i++; }
    else if (k === "--in") { a.in = v; i++; }
    else if (k === "--name") { a.name = v; i++; }
    else if (k === "--out") { a.out = v; i++; }
    else if (k === "--model") { a.model = v; i++; }
    else if (k === "--base-url") { a.baseUrl = v; i++; }
    else if (k === "--auth") { a.auth = v; i++; }
  }
  return a;
}

const isUrl = (s) => /^https?:\/\//i.test(s);
const strArr = (x) => (Array.isArray(x) ? x.filter((s) => typeof s === "string") : []);
const str = (x, d = "") => (typeof x === "string" ? x : d);

// Normalize any raw object (extract result or authored partial) into a well-formed, complete token.
export function normalizeToken(raw, nameOverride) {
  const t = raw && typeof raw === "object" ? raw : {};
  const p = t.palette && typeof t.palette === "object" ? t.palette : {};
  const ty = t.typography && typeof t.typography === "object" ? t.typography : {};
  return {
    name: nameOverride || str(t.name, "untitled-theme"),
    north_star: str(t.north_star),
    palette: {
      base: strArr(p.base),
      accent_primary: str(p.accent_primary),
      accent_highlight: str(p.accent_highlight),
      accents_allowed: strArr(p.accents_allowed),
      rule: str(p.rule),
    },
    typography: { display: str(ty.display), body: str(ty.body), mono: str(ty.mono) },
    feel_words: strArr(t.feel_words),
    anti_feel: strArr(t.anti_feel),
    lighting: str(t.lighting),
    emblem_refs: strArr(t.emblem_refs),
    prompt_suffix: str(t.prompt_suffix),
  };
}

// A token is usable if it carries at least some palette signal (base or a primary accent).
export function isUsable(tok) {
  return tok.palette.base.length > 0 || tok.palette.accent_primary !== "";
}

async function imageUrlPart(image) {
  if (isUrl(image)) return { type: "image_url", image_url: { url: image } };
  const bytes = await readFile(image);
  const mime = MIME[extname(image).toLowerCase()] || "image/png";
  return { type: "image_url", image_url: { url: `data:${mime};base64,${bytes.toString("base64")}` } };
}

function extractSystemPrompt() {
  return [
    "You are a brand/art director. Analyze the reference image and distill a reusable STYLE TOKEN.",
    "Return ONLY a JSON object matching the schema. No prose outside JSON.",
    "Read real hex colors from the image for palette.base + accents. Keep the palette rule concrete.",
    "prompt_suffix must be a short phrase that, appended to any generator prompt, reproduces this look.",
    `Schema: ${JSON.stringify(TOKEN_SCHEMA)}`,
  ].join("\n");
}

async function main() {
  const a = parseArgs(process.argv.slice(2));
  if (a.help) {
    console.log('Usage:\n  extract: GEMINI_API_KEY=... node brandkit.mjs --from <img|url> [--name x] [--out brandkit.json]\n  author:  node brandkit.mjs --author [--in partial.json] [--name x] [--out brandkit.json]\n  [--model m] [--base-url url] [--auth bearer|x-api-key] [--dry-run] [--schema]');
    return;
  }
  if (a.schema) { console.log(JSON.stringify(TOKEN_SCHEMA, null, 2)); return; }
  if (!a.from && !a.author) fail("choose a mode: --from <image> (extract) or --author (define)");
  if (a.from && a.author) fail("--from and --author are mutually exclusive");

  // ---- author mode: validate/fill a hand-written token, no key/network ----
  if (a.author) {
    let partial = {};
    if (a.in) {
      try { partial = JSON.parse(await readFile(a.in, "utf8")); }
      catch (e) { fail(`could not read --in: ${e.message}`); }
    }
    const token = normalizeToken(partial, a.name);
    const out = resolve(a.out);
    await mkdir(dirname(out), { recursive: true });
    await writeFile(out, JSON.stringify(token, null, 2));
    console.log(JSON.stringify({ ok: true, mode: "author", name: token.name, path: out, token }));
    return;
  }

  // ---- extract mode: vision LLM reads the reference ----
  const sys = extractSystemPrompt();
  if (a.dryRun) {
    console.log(JSON.stringify({ ok: true, dryRun: true, mode: "extract", from: a.from,
      model: a.model, endpoint: `${a.baseUrl}/chat/completions`, out: resolve(a.out),
      schema_fields: Object.keys(TOKEN_SCHEMA) }, null, 2));
    return;
  }

  const key = process.env.GEMINI_API_KEY || process.env.BRANDKIT_API_KEY;
  if (!key) fail("GEMINI_API_KEY (or BRANDKIT_API_KEY) not set — export your Google Gemini API key from https://aistudio.google.com/apikey (or point --base-url/--model at another OpenAI-compatible vision endpoint)");

  let imgPart;
  try { imgPart = await imageUrlPart(a.from); }
  catch (e) { fail(`could not read --from: ${e.message}`); }

  const headers = { "Content-Type": "application/json" };
  if (a.auth === "x-api-key") headers["x-api-key"] = key; else headers["Authorization"] = `Bearer ${key}`;

  const res = await fetch(`${a.baseUrl}/chat/completions`, {
    method: "POST", headers,
    body: JSON.stringify({
      model: a.model, temperature: 0, response_format: { type: "json_object" },
      messages: [
        { role: "system", content: sys },
        { role: "user", content: [{ type: "text", text: "Distill the style token from this reference. Return the token JSON only." }, imgPart] },
      ],
    }),
  });
  if (!res.ok) fail(`vision endpoint ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) fail("no content in vision response");

  let rawTok;
  try { rawTok = typeof content === "string" ? JSON.parse(content) : content; }
  catch { fail(`model did not return JSON: ${String(content).slice(0, 200)}`); }

  const token = normalizeToken(rawTok, a.name);
  if (!isUsable(token)) fail("extracted token has no usable palette — try a clearer reference or --author");

  const out = resolve(a.out);
  await mkdir(dirname(out), { recursive: true });
  await writeFile(out, JSON.stringify(token, null, 2));
  console.log(JSON.stringify({ ok: true, mode: "extract", name: token.name, path: out, token }));
}

if (pathToFileURL(process.argv[1] || "").href === import.meta.url) {
  main().catch((err) => fail(err instanceof Error ? err.message : String(err)));
}
