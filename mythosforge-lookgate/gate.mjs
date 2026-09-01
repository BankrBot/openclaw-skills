#!/usr/bin/env node
// mythosforge-lookgate — score an image against a visual-QA rubric and return a
// structured PASS/FAIL verdict (JSON). The self-verify half of the MythosForge suite.
//
// BYO key: default provider = Google Gemini (vision) via its OpenAI-compatible layer.
// Override --base-url/--model for any other OpenAI-compatible vision endpoint.
// Zero npm dependencies (Node 18+ global fetch).
//
// Usage:
//   GEMINI_API_KEY=... node gate.mjs --image ./shot.png [--rubric r.json] [--palette p.json]
//                                         [--threshold 0.8] [--set] [--model gemini-3.5-flash] [--out verdict.json]
//   node gate.mjs --image ./shot.png --dry-run   # print the composed request, no key, no spend
//   node gate.mjs --schema                       # print the verdict schema and exit
//
// Success -> prints the verdict JSON (shiro's schema). Failure -> { "ok": false, "error": "..." } + exit 1.
// Read references/lookgate-rubric.md for the rubric + verdict contract.

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve, extname } from "node:path";
import { pathToFileURL } from "node:url";

const RUBRIC_ID = "default-visual-v1";
// shiro's default general-purpose visual-QA rubric (references/lookgate-rubric.md).
const DEFAULT_RUBRIC = [
  { id: "crisp", criterion: "structured, readable form; sharp not blobby/melted", fail: "mushy, clay, artifacted" },
  { id: "subject_clear", criterion: "the intended subject is legible/identifiable", fail: "ambiguous, cropped, cut off" },
  { id: "in_palette", criterion: "colors sit inside the supplied theme/palette (if given)", fail: "off-ramp / clashing colors" },
  { id: "contrast", criterion: "subject reads against its background", fail: "washed out, muddy, low-contrast" },
  { id: "composition", criterion: "framed/balanced, not awkwardly cut or empty", fail: "subject jammed to edge, dead space" },
  { id: "no_artifacts", criterion: "no watermark, garbled text, extra limbs, seams", fail: "visible generation artifacts" },
  { id: "lighting", criterion: "intended lighting holds (e.g. night vs day if specified)", fail: "wrong time-of-day/mood" },
  { id: "text_legible", criterion: "any text/labels are readable (na if none)", fail: "garbled/unreadable text" },
];

const VERDICT_SCHEMA = {
  verdict: "pass | fail",
  score: "number 0..1",
  criteria: [{ id: "string", result: "pass | fail | na", reason: "one line" }],
  fails: ["<criterion ids that failed>"],
  suggestion: "concrete regen/nudge hint",
  rubric_id: "string",
  image: "string",
};

const MIME = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".gif": "image/gif" };
const fail = (msg) => { console.error(JSON.stringify({ ok: false, error: msg })); process.exit(1); };

function parseArgs(argv) {
  const a = { image: "", rubric: "", palette: "", threshold: null, set: false, out: "",
    // Default provider = Google Gemini via its OpenAI-compatible layer (approved additional
    // provider for vision/judge skills). Override --base-url/--model for any other
    // OpenAI-compatible vision endpoint. Source: https://ai.google.dev/gemini-api/docs/openai
    model: process.env.LOOKGATE_MODEL || "gemini-3.5-flash",
    baseUrl: process.env.LOOKGATE_BASE_URL || "https://generativelanguage.googleapis.com/v1beta/openai",
    auth: "bearer", dryRun: false, schema: false };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (k === "--dry-run") { a.dryRun = true; continue; }
    if (k === "--schema") { a.schema = true; continue; }
    if (k === "--set") { a.set = true; continue; }
    if (k === "--help" || k === "-h") { a.help = true; continue; }
    const v = argv[i + 1];
    if (k === "--image") { a.image = v; i++; }
    else if (k === "--rubric") { a.rubric = v; i++; }
    else if (k === "--palette") { a.palette = v; i++; }
    else if (k === "--threshold") { a.threshold = Number(v); i++; }
    else if (k === "--out") { a.out = v; i++; }
    else if (k === "--model") { a.model = v; i++; }
    else if (k === "--base-url") { a.baseUrl = v; i++; }
    else if (k === "--auth") { a.auth = v; i++; }
  }
  return a;
}

const isUrl = (s) => /^https?:\/\//i.test(s);

async function imageUrlPart(image) {
  if (isUrl(image)) return { type: "image_url", image_url: { url: image } };
  const bytes = await readFile(image); // throws if missing -> caught by main
  const mime = MIME[extname(image).toLowerCase()] || "image/png";
  return { type: "image_url", image_url: { url: `data:${mime};base64,${bytes.toString("base64")}` } };
}

function systemPrompt(rubric, palette, set, threshold) {
  const lines = [
    "You are a STRICT visual-QA gate. Score the image against the rubric below.",
    "Return ONLY a JSON object matching the verdict schema. No prose outside JSON.",
    "",
    "Rubric (score each `pass`, `fail`, or `na` with a one-line reason):",
    ...rubric.map((c) => `- ${c.id}: ${c.criterion}  (fail = ${c.fail})`),
  ];
  if (palette) lines.push("", `Supplied theme/palette to check 'in_palette' against:\n${palette}`);
  if (set) lines.push("", "SET MODE: also apply distinctness — no two items share silhouette+color (>=3/5 differ); structure must sit on a solid body, not a hollow cage. Fail 'composition' if violated.");
  lines.push("",
    threshold != null
      ? `Set "score" in 0..1 (fraction of non-na criteria passing). verdict = "pass" if score >= ${threshold}, else "fail".`
      : `Set "score" in 0..1 (fraction of non-na criteria passing). verdict = "fail" if ANY non-na criterion fails, else "pass".`,
    'Include "fails" (array of failed criterion ids) and "suggestion" (a concrete regen/nudge hint).',
    `Verdict schema: ${JSON.stringify(VERDICT_SCHEMA)}`,
  );
  return lines.join("\n");
}

// Re-derive EVERY gate field on OUR side so the verdict can't be spoofed by the model.
// `raw.score` is deliberately IGNORED — score is always computed from the per-criterion results
// (else a model could return failing criteria + score:1 and slip past a --threshold gate).
export function finalize(raw, image, threshold) {
  const norm = (r) => (r === "pass" || r === "fail" || r === "na" ? r : "na"); // invalid result -> na
  const criteria = (Array.isArray(raw?.criteria) ? raw.criteria : [])
    .map((c) => ({ id: String(c?.id ?? ""), result: norm(c?.result), reason: String(c?.reason ?? "") }));
  const fails = criteria.filter((c) => c.result === "fail").map((c) => c.id);
  const scored = criteria.filter((c) => c.result === "pass" || c.result === "fail");
  const score = scored.length ? scored.filter((c) => c.result === "pass").length / scored.length : 0;
  const clamped = Math.min(1, Math.max(0, Math.round(score * 100) / 100));
  const verdict = threshold != null ? (clamped >= threshold ? "pass" : "fail") : (fails.length ? "fail" : "pass");
  return { verdict, score: clamped, criteria, fails,
    suggestion: (typeof raw?.suggestion === "string" && raw.suggestion) || (fails.length ? `address: ${fails.join(", ")}` : "none"),
    rubric_id: RUBRIC_ID, image };
}

async function main() {
  const a = parseArgs(process.argv.slice(2));
  if (a.help) {
    console.log('Usage: GEMINI_API_KEY=... node gate.mjs --image <path|url> [--rubric r.json] [--palette p.json] [--threshold 0..1] [--set] [--model m] [--base-url url] [--auth bearer|x-api-key] [--out f] [--dry-run] [--schema]');
    return;
  }
  if (a.schema) { console.log(JSON.stringify(VERDICT_SCHEMA, null, 2)); return; }
  if (!a.image) fail("--image required (path or URL to the image to score)");
  if (a.threshold != null && (Number.isNaN(a.threshold) || a.threshold < 0 || a.threshold > 1)) fail("--threshold must be 0..1");

  let rubric = DEFAULT_RUBRIC;
  if (a.rubric) {
    try { rubric = JSON.parse(await readFile(a.rubric, "utf8")); }
    catch (e) { fail(`could not read --rubric: ${e.message}`); }
    if (!Array.isArray(rubric) || !rubric.length) fail("--rubric must be a non-empty JSON array");
  }
  let palette = "";
  if (a.palette) {
    try { palette = isUrl(a.palette) ? a.palette : await readFile(a.palette, "utf8"); }
    catch (e) { fail(`could not read --palette: ${e.message}`); }
  }

  const sys = systemPrompt(rubric, palette, a.set, a.threshold);

  if (a.dryRun) {
    console.log(JSON.stringify({
      ok: true, dryRun: true, image: a.image, rubric_id: RUBRIC_ID, model: a.model,
      endpoint: `${a.baseUrl}/chat/completions`, criteria: rubric.map((c) => c.id),
      threshold: a.threshold, set: a.set, system_preview: sys.slice(0, 600),
    }, null, 2));
    return;
  }

  const key = process.env.GEMINI_API_KEY || process.env.LOOKGATE_API_KEY;
  if (!key) fail("GEMINI_API_KEY (or LOOKGATE_API_KEY) not set — export your Google Gemini API key from https://aistudio.google.com/apikey (or point --base-url/--model at another OpenAI-compatible vision endpoint)");

  let imgPart;
  try { imgPart = await imageUrlPart(a.image); }
  catch (e) { fail(`could not read --image: ${e.message}`); }

  const headers = { "Content-Type": "application/json" };
  if (a.auth === "x-api-key") headers["x-api-key"] = key; else headers["Authorization"] = `Bearer ${key}`;

  const res = await fetch(`${a.baseUrl}/chat/completions`, {
    method: "POST", headers,
    body: JSON.stringify({
      model: a.model, temperature: 0, response_format: { type: "json_object" },
      messages: [
        { role: "system", content: sys },
        { role: "user", content: [{ type: "text", text: "Score this image. Return the verdict JSON only." }, imgPart] },
      ],
    }),
  });
  if (!res.ok) fail(`vision endpoint ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) fail("no content in vision response");

  let raw;
  try { raw = typeof content === "string" ? JSON.parse(content) : content; }
  catch { fail(`model did not return JSON: ${String(content).slice(0, 200)}`); }

  const verdict = finalize(raw, a.image, a.threshold);
  if (a.out) {
    const out = resolve(a.out);
    await mkdir(dirname(out), { recursive: true });
    await writeFile(out, JSON.stringify(verdict, null, 2));
  }
  console.log(JSON.stringify(verdict));
}

// Only run the CLI when invoked directly (so selftest.mjs can import finalize()).
if (pathToFileURL(process.argv[1] || "").href === import.meta.url) {
  main().catch((err) => fail(err instanceof Error ? err.message : String(err)));
}
