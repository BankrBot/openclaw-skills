#!/usr/bin/env node
// mythosforge-3d — convert an image into a 3D model (GLB) via Replicate.
// BYO REPLICATE_API_TOKEN (same key as the generators). Zero npm deps (Node 18+ fetch).
//
// Usage:
//   REPLICATE_API_TOKEN=r8_... node to3d.mjs --image ./sprite.png [--out out.glb]
//   REPLICATE_API_TOKEN=r8_... node to3d.mjs --image ./sprite.png --model ndreca/hunyuan3d-2
//   node to3d.mjs --image ./sprite.png --dry-run   # print the request, no key, no spend
//
// Prints a JSON result line: { ok, image, model, path, bytes }.

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve, extname } from "node:path";
import { pathToFileURL } from "node:url";

// Per-model config. Two things differ across 3D models and BOTH matter:
//   imageMode — how the image goes in: "array" (`images: [ref]`) vs "single" (`image: ref`)
//   outputKey — the named key in the OUTPUT OBJECT holding the GLB uri (NOT a bare string/array!)
// Verify slug + fields from https://replicate.com/<owner>/<model>/llms.txt.
export const DEFAULT_SLUG = "firtoz/trellis";
export const MODELS = {
  "firtoz/trellis": { imageMode: "array", outputKey: "model_file", license: "MIT" },
  "ndreca/hunyuan3d-2": { imageMode: "single", outputKey: "mesh", license: "Tencent community (non-MIT)" },
};
export const EXT = "glb";

const MIME = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".gif": "image/gif" };
const fail = (msg) => { console.error(JSON.stringify({ ok: false, error: msg })); process.exit(1); };

// Pure input builder (unit-tested): wrap the image per the model's input mode.
export function buildInput(ref, imageMode) {
  return imageMode === "array" ? { images: [ref] } : { image: ref };
}

// Resolve the per-model image-mode + output-key (unit-tested). Model APIs differ, so an unmapped
// --model must NOT silently guess: it requires explicit --image-mode + --output-key. Returns
// { imageMode, outputKey } or { error }.
export function resolveConfig(slug, imageModeArg, outputKeyArg) {
  if (imageModeArg && imageModeArg !== "array" && imageModeArg !== "single") {
    return { error: "--image-mode must be 'array' or 'single'" };
  }
  const known = MODELS[slug];
  if (!known && (!imageModeArg || !outputKeyArg)) {
    return { error: `unmapped --model '${slug}' needs both --image-mode array|single and --output-key <key> (verify from the model's llms.txt)` };
  }
  return { imageMode: imageModeArg || known?.imageMode, outputKey: outputKeyArg || known?.outputKey };
}

// Pure GLB extractor (unit-tested). 3D models return an OBJECT with a named key (model_file / mesh),
// so a plain string/array picker returns null on SUCCESS. Try the named key, then fall back to
// scanning for a .glb uri, then any url — so an unmapped --model still works if it returns a glb.
export function pickGlb(output, outputKey) {
  const asUrl = (v) => (typeof v === "string" ? v : v && typeof v.url === "string" ? v.url : null);
  const isGlb = (s) => typeof s === "string" && /\.glb(\?|$)/i.test(s);
  if (!output) return null;
  if (typeof output === "string") return output;
  if (output && typeof output === "object" && !Array.isArray(output) && outputKey) {
    const u = asUrl(output[outputKey]);
    if (u) return u;
  }
  const candidates = Array.isArray(output)
    ? output.map(asUrl).filter(Boolean)
    : Object.values(output).map(asUrl).filter(Boolean);
  return candidates.find(isGlb) || candidates[0] || null;
}

function parseArgs(argv) {
  const a = { image: "", out: "", slug: "", imageMode: "", outputKey: "", dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (k === "--dry-run") { a.dryRun = true; continue; }
    if (k === "--help" || k === "-h") { a.help = true; continue; }
    const v = argv[i + 1];
    if (k === "--image") { a.image = v; i++; }
    else if (k === "--out") { a.out = v; i++; }
    else if (k === "--model" || k === "--slug") { a.slug = v; i++; }
    else if (k === "--image-mode") { a.imageMode = v; i++; }
    else if (k === "--output-key") { a.outputKey = v; i++; }
  }
  return a;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const isUrl = (s) => /^https?:\/\//i.test(s);

async function imageRefOf(image) {
  if (isUrl(image)) return image;
  const bytes = await readFile(image);
  const mime = MIME[extname(image).toLowerCase()] || "image/png";
  return `data:${mime};base64,${bytes.toString("base64")}`;
}

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
  const deadline = Date.now() + 600_000; // 3D gen is slow — up to 10 min
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

async function main() {
  const a = parseArgs(process.argv.slice(2));
  if (a.help) {
    console.log('Usage: REPLICATE_API_TOKEN=r8_... node to3d.mjs --image <path|url> [--out path.glb] [--model <slug>] [--image-mode array|single] [--output-key <key>] [--dry-run]');
    return;
  }
  if (!a.image) fail("--image required (path or URL to the source image)");

  const slug = a.slug || DEFAULT_SLUG;
  const { imageMode, outputKey, error } = resolveConfig(slug, a.imageMode, a.outputKey);
  if (error) fail(error);
  const out = resolve(a.out || `out/model.${EXT}`);

  if (a.dryRun) {
    const shape = buildInput("<image>", imageMode);
    console.log(JSON.stringify({ ok: true, dryRun: true, image: a.image, out, model: slug, imageMode, outputKey,
      request: {
        resolve: `GET https://api.replicate.com/v1/models/${slug}`,
        endpoint: `POST https://api.replicate.com/v1/predictions`,
        body: { version: "<latest_version.id resolved from model>", input: shape },
      } }, null, 2));
    return;
  }

  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) fail("REPLICATE_API_TOKEN not set — export your own Replicate key (https://replicate.com/account/api-tokens)");

  let ref;
  try { ref = await imageRefOf(a.image); }
  catch (e) { fail(`could not read --image: ${e.message}`); }

  const input = buildInput(ref, imageMode);
  const version = await resolveVersion(token, slug);
  const pred = await startPrediction(token, version, input);
  const output = pred.status === "succeeded" ? pred.output : await waitFor(token, pred);
  const url = pickGlb(output, outputKey);
  if (!url) fail(`no GLB in prediction output (looked for key '${outputKey}' then any .glb) — check the model's output schema`);

  const dl = await fetch(url);
  if (!dl.ok) fail(`download ${dl.status}`);
  const bytes = Buffer.from(await dl.arrayBuffer());

  await mkdir(dirname(out), { recursive: true });
  await writeFile(out, bytes);
  console.log(JSON.stringify({ ok: true, image: a.image, model: slug, path: out, bytes: bytes.length }));
}

if (pathToFileURL(process.argv[1] || "").href === import.meta.url) {
  main().catch((err) => fail(err instanceof Error ? err.message : String(err)));
}
