#!/usr/bin/env node
// mythosforge-video — generate a short video from a text prompt (optionally image-to-video from a
// first frame), via Replicate. BYO REPLICATE_API_TOKEN (same key as the generators).
// Zero npm dependencies (Node 18+ global fetch).
//
// Usage:
//   REPLICATE_API_TOKEN=r8_... node video.mjs --prompt "a drone shot over a neon city" [--out out.mp4]
//   REPLICATE_API_TOKEN=r8_... node video.mjs --prompt "camera pushes in" --image ./first.png [--out out.mp4]
//   node video.mjs --prompt "..." --dry-run   # print the request, no key, no spend
//
// Prints a JSON result line: { ok, prompt, image, path, bytes }.

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve, extname } from "node:path";
import { pathToFileURL } from "node:url";

// Known video models + their image-input field (NOT uniform across models: seedance uses `image`,
// hailuo uses `first_frame_image`, others `start_image`/`image_url`). Text->video is uniform (prompt
// only). For a --model not listed here, pass --image-field <key> to do image->video. Verify any slug
// + fields from https://replicate.com/<owner>/<model>/llms.txt.
export const DEFAULT_SLUG = "bytedance/seedance-2.0";
export const MODELS = {
  "bytedance/seedance-2.0": { imageField: "image" },
  "minimax/hailuo-2.3": { imageField: "first_frame_image" },
};
export const EXT = "mp4";

// --duration, when provided, must be an integer (models want ints; -1 = auto on Seedance).
export function isValidDuration(d) {
  return d === null || Number.isInteger(d);
}

// Pure input builder (unit-tested). image is optional; duration/resolution only added when provided.
export function buildInput(prompt, imageRef, imageField, opts = {}) {
  const input = { prompt };
  if (opts.duration != null) input.duration = opts.duration;
  if (opts.resolution) input.resolution = opts.resolution;
  if (imageRef) input[imageField] = imageRef;
  return input;
}

const MIME = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".gif": "image/gif" };
const MAX_PROMPT_LEN = 4000;
const fail = (msg) => { console.error(JSON.stringify({ ok: false, error: msg })); process.exit(1); };

function parseArgs(argv) {
  const a = { prompt: "", image: "", imageField: "", duration: null, resolution: "", out: "", slug: "", dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (k === "--dry-run") { a.dryRun = true; continue; }
    if (k === "--help" || k === "-h") { a.help = true; continue; }
    const v = argv[i + 1];
    if (k === "--prompt") { a.prompt = v; i++; }
    else if (k === "--image") { a.image = v; i++; }
    else if (k === "--image-field") { a.imageField = v; i++; }
    else if (k === "--duration") { a.duration = Number(v); i++; }
    else if (k === "--resolution") { a.resolution = v; i++; }
    else if (k === "--out") { a.out = v; i++; }
    else if (k === "--model" || k === "--slug") { a.slug = v; i++; }
  }
  return a;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const isUrl = (s) => /^https?:\/\//i.test(s);

export function pickUrl(output) {
  if (!output) return null;
  if (typeof output === "string") return output;
  if (Array.isArray(output)) return output.find((x) => typeof x === "string") ?? null;
  if (typeof output === "object" && typeof output.url === "string") return output.url;
  return null;
}

async function imageRefOf(image) {
  if (isUrl(image)) return image;
  const bytes = await readFile(image);
  const mime = MIME[extname(image).toLowerCase()] || "image/png";
  return `data:${mime};base64,${bytes.toString("base64")}`;
}

// Resolve latest version, then POST /v1/predictions { version, input } — works for official + community.
async function resolveVersion(token, slug) {
  const res = await fetch(`https://api.replicate.com/v1/models/${slug}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`resolve model ${slug}: ${res.status}`);
  const data = await res.json();
  const v = data?.latest_version?.id;
  if (!v) throw new Error(`no latest_version for ${slug}`);
  return v;
}

async function startPrediction(token, version, input) {
  const res = await fetch(`https://api.replicate.com/v1/predictions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Prefer: "wait=60" },
    body: JSON.stringify({ version, input }),
  });
  if (!res.ok) throw new Error(`replicate ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

async function waitFor(token, pred) {
  const deadline = Date.now() + 600_000; // video gen is slow — up to 10 min
  while (!["succeeded", "failed", "canceled"].includes(pred.status)) {
    if (Date.now() > deadline) throw new Error("timed out after 600s");
    await sleep(3000);
    const r = await fetch(pred.urls.get, { headers: { Authorization: `Bearer ${token}` } });
    if (!r.ok) throw new Error(`replicate poll ${r.status}`);
    pred = await r.json();
  }
  if (pred.status !== "succeeded") throw new Error(`prediction ${pred.status}: ${pred.error ?? "no detail"}`);
  return pred.output;
}

// Resolve which input key holds the first-frame image for this model.
function imageFieldFor(slug, override) {
  return override || MODELS[slug]?.imageField || null;
}

async function main() {
  const a = parseArgs(process.argv.slice(2));
  if (a.help) {
    console.log('Usage: REPLICATE_API_TOKEN=r8_... node video.mjs --prompt "..." [--image <first-frame path|url>] [--image-field <key>] [--duration n] [--resolution 720p] [--out path] [--model <slug>] [--dry-run]');
    return;
  }
  const prompt = (a.prompt ?? "").trim();
  if (!prompt) fail('--prompt "..." required');
  if (prompt.length > MAX_PROMPT_LEN) fail(`prompt too long (max ${MAX_PROMPT_LEN})`);
  if (!isValidDuration(a.duration)) fail("--duration must be an integer (e.g. 6, 10, or -1 for auto)");

  const slug = a.slug || DEFAULT_SLUG;
  const out = resolve(a.out || `out/video.${EXT}`);
  const opts = { duration: a.duration, resolution: a.resolution || undefined };

  // image->video needs the right per-model image field; text->video is uniform (prompt only).
  let imageField = null;
  if (a.image) {
    imageField = imageFieldFor(slug, a.imageField);
    if (!imageField) fail(`--image needs the model's image-input field for '${slug}'. Pass --image-field <key> (e.g. image | first_frame_image | start_image), verify from the model's llms.txt`);
  }

  if (a.dryRun) {
    const shape = buildInput(prompt, a.image ? "<first-frame image>" : undefined, imageField, opts);
    console.log(JSON.stringify({ ok: true, dryRun: true, prompt, image: a.image || null, imageField, out, model: slug,
      request: {
        resolve: `GET https://api.replicate.com/v1/models/${slug}`,
        endpoint: `POST https://api.replicate.com/v1/predictions`,
        body: { version: "<latest_version.id resolved from model>", input: shape },
      } }, null, 2));
    return;
  }

  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) fail("REPLICATE_API_TOKEN not set — export your own Replicate key (https://replicate.com/account/api-tokens)");

  let imageRef;
  if (a.image) {
    try { imageRef = await imageRefOf(a.image); }
    catch (e) { fail(`could not read --image: ${e.message}`); }
  }

  const input = buildInput(prompt, imageRef, imageField, opts);
  const version = await resolveVersion(token, slug);
  const pred = await startPrediction(token, version, input);
  const output = pred.status === "succeeded" ? pred.output : await waitFor(token, pred);
  const url = pickUrl(output);
  if (!url) fail("no output URL in prediction");

  const dl = await fetch(url);
  if (!dl.ok) fail(`download ${dl.status}`);
  const bytes = Buffer.from(await dl.arrayBuffer());

  await mkdir(dirname(out), { recursive: true });
  await writeFile(out, bytes);
  console.log(JSON.stringify({ ok: true, prompt, image: a.image || null, path: out, bytes: bytes.length }));
}

if (pathToFileURL(process.argv[1] || "").href === import.meta.url) {
  main().catch((err) => fail(err instanceof Error ? err.message : String(err)));
}
