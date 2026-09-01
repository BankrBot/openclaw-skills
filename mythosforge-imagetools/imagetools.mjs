#!/usr/bin/env node
// mythosforge-imagetools — upscale or remove-background an image via Replicate.
// Two utility ops in one skill. BYO REPLICATE_API_TOKEN (same key as the generators).
// Zero npm dependencies (Node 18+ global fetch).
//
// Usage:
//   REPLICATE_API_TOKEN=r8_... node imagetools.mjs --op upscale    --image ./in.png [--scale 4] [--out out.png]
//   REPLICATE_API_TOKEN=r8_... node imagetools.mjs --op bg-remove  --image ./in.png [--out cutout.png]
//   node imagetools.mjs --image ./in.png --op upscale --dry-run   # print the request, spend nothing
//
// Prints a JSON result line: { ok, op, image, path, bytes }.

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve, extname } from "node:path";
import { pathToFileURL } from "node:url";

// The Replicate model behind each op. VERIFY each slug + input schema at wire time from
// https://replicate.com/<owner>/<model>/llms.txt — Replicate renames/retires community models.
export const OPS = {
  upscale: {
    slug: "nightmareai/real-esrgan",
    ext: "png",
    input: (image, a) => ({ image, scale: a.scale, face_enhance: false }),
  },
  "bg-remove": {
    slug: "cjwbw/rembg",
    ext: "png",
    input: (image) => ({ image }),
  },
};

const MIME = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".gif": "image/gif" };
const fail = (msg) => { console.error(JSON.stringify({ ok: false, error: msg })); process.exit(1); };

function parseArgs(argv) {
  const a = { op: "", image: "", scale: 4, out: "", slug: "", dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (k === "--dry-run") { a.dryRun = true; continue; }
    if (k === "--help" || k === "-h") { a.help = true; continue; }
    const v = argv[i + 1];
    if (k === "--op") { a.op = v; i++; }
    else if (k === "--image") { a.image = v; i++; }
    else if (k === "--scale") { a.scale = Number(v); i++; }
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

async function imageRef(image) {
  if (isUrl(image)) return image;
  const bytes = await readFile(image);
  const mime = MIME[extname(image).toLowerCase()] || "image/png";
  return `data:${mime};base64,${bytes.toString("base64")}`;
}

// Resolve a model's latest version id. Works for BOTH official and community models — the
// no-version /v1/models/<slug>/predictions endpoint is only reliable for official/publisher
// models, and these ops use community models (real-esrgan, rembg). So we resolve + use /v1/predictions.
async function resolveVersion(token, slug) {
  const res = await fetch(`https://api.replicate.com/v1/models/${slug}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
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
  const deadline = Date.now() + 180_000; // upscale can be slow at high scale
  while (!["succeeded", "failed", "canceled"].includes(pred.status)) {
    if (Date.now() > deadline) throw new Error("timed out after 180s");
    await sleep(1500);
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
    console.log('Usage: REPLICATE_API_TOKEN=r8_... node imagetools.mjs --op upscale|bg-remove --image <path|url> [--scale 4] [--out path] [--model <slug>] [--dry-run]');
    return;
  }
  const op = OPS[a.op];
  if (!a.op) fail(`--op required (${Object.keys(OPS).join(" | ")})`);
  if (!op) fail(`unknown op '${a.op}' (use ${Object.keys(OPS).join(" | ")})`);
  if (!a.image) fail("--image required (path or URL to the input image)");
  if (a.op === "upscale" && (Number.isNaN(a.scale) || a.scale < 1 || a.scale > 10)) fail("--scale must be 1..10");

  const slug = a.slug || op.slug;
  const out = resolve(a.out || `out/${a.op}.${op.ext}`);

  if (a.dryRun) {
    // note the input image field without inlining megabytes of base64
    const shape = a.op === "upscale" ? { image: "<image>", scale: a.scale, face_enhance: false } : { image: "<image>" };
    console.log(JSON.stringify({ ok: true, dryRun: true, op: a.op, image: a.image, out, model: slug,
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
  try { ref = await imageRef(a.image); }
  catch (e) { fail(`could not read --image: ${e.message}`); }

  const input = a.op === "upscale" ? op.input(ref, a) : op.input(ref);
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
  console.log(JSON.stringify({ ok: true, op: a.op, image: a.image, path: out, bytes: bytes.length }));
}

if (pathToFileURL(process.argv[1] || "").href === import.meta.url) {
  main().catch((err) => fail(err instanceof Error ? err.message : String(err)));
}
