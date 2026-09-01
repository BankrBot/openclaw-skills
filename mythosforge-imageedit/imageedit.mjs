#!/usr/bin/env node
// mythosforge-imageedit — edit an image with a prompt (instruction img2img) or inpaint a masked
// region, via Replicate. BYO REPLICATE_API_TOKEN (same key as the generators).
// Zero npm dependencies (Node 18+ global fetch).
//
// Usage:
//   REPLICATE_API_TOKEN=r8_... node imageedit.mjs --op edit    --image ./in.png --prompt "make it snowy" [--out out.png]
//   REPLICATE_API_TOKEN=r8_... node imageedit.mjs --op inpaint --image ./in.png --mask ./mask.png --prompt "a red door" [--out out.png]
//   node imageedit.mjs --op edit --image ./in.png --prompt "..." --dry-run   # print the request, no key
//
// Prints a JSON result line: { ok, op, image, path, bytes }.

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve, extname } from "node:path";
import { pathToFileURL } from "node:url";

// The Replicate model behind each op. Both need version-resolution (see resolveVersion) and their
// exact input field names should be VERIFIED from https://replicate.com/<owner>/<model>/llms.txt —
// swap with --model <slug> without editing code.
export const OPS = {
  edit: {
    slug: "black-forest-labs/flux-kontext-pro",
    ext: "png",
    needsMask: false,
    input: (image, a) => ({ prompt: a.prompt, input_image: image, output_format: "png" }),
  },
  inpaint: {
    slug: "black-forest-labs/flux-fill-pro",
    ext: "png",
    needsMask: true,
    input: (image, a) => ({ prompt: a.prompt, image, mask: a.maskRef, output_format: "png" }),
  },
};

const MIME = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".gif": "image/gif" };
const MAX_PROMPT_LEN = 2000;
const fail = (msg) => { console.error(JSON.stringify({ ok: false, error: msg })); process.exit(1); };

function parseArgs(argv) {
  const a = { op: "", image: "", prompt: "", mask: "", out: "", slug: "", dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (k === "--dry-run") { a.dryRun = true; continue; }
    if (k === "--help" || k === "-h") { a.help = true; continue; }
    const v = argv[i + 1];
    if (k === "--op") { a.op = v; i++; }
    else if (k === "--image") { a.image = v; i++; }
    else if (k === "--prompt") { a.prompt = v; i++; }
    else if (k === "--mask") { a.mask = v; i++; }
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

// Community-model-safe: resolve latest version, then POST /v1/predictions { version, input }.
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
  const deadline = Date.now() + 180_000;
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
    console.log('Usage: REPLICATE_API_TOKEN=r8_... node imageedit.mjs --op edit|inpaint --image <path|url> --prompt "..." [--mask <path|url> (inpaint)] [--out path] [--model <slug>] [--dry-run]');
    return;
  }
  const op = OPS[a.op];
  if (!a.op) fail(`--op required (${Object.keys(OPS).join(" | ")})`);
  if (!op) fail(`unknown op '${a.op}' (use ${Object.keys(OPS).join(" | ")})`);
  if (!a.image) fail("--image required (path or URL to the input image)");
  const prompt = (a.prompt ?? "").trim();
  if (!prompt) fail('--prompt "..." required (the edit instruction)');
  if (prompt.length > MAX_PROMPT_LEN) fail(`prompt too long (max ${MAX_PROMPT_LEN})`);
  if (op.needsMask && !a.mask) fail("--mask required for inpaint (path or URL; white = area to fill)");

  const slug = a.slug || op.slug;
  const out = resolve(a.out || `out/${a.op}.${op.ext}`);

  if (a.dryRun) {
    const shape = op.needsMask
      ? { prompt, image: "<image>", mask: "<mask>", output_format: "png" }
      : { prompt, input_image: "<image>", output_format: "png" };
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

  let ref, maskRef;
  try { ref = await imageRef(a.image); }
  catch (e) { fail(`could not read --image: ${e.message}`); }
  if (op.needsMask) {
    try { maskRef = await imageRef(a.mask); }
    catch (e) { fail(`could not read --mask: ${e.message}`); }
  }

  const input = op.input(ref, { prompt, maskRef });
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
