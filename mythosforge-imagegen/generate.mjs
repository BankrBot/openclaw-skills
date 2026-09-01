#!/usr/bin/env node
// mythosforge-imagegen — standalone image generation for AI agents.
//
// Lifts MythosForge's audited Replicate render logic out of the Bankr/x402
// paywall into a dead-simple, self-contained CLI. The calling agent supplies
// its OWN REPLICATE_API_TOKEN — there is no wallet, no payment layer, no
// MythosForge account involved. Zero npm dependencies (Node 18+ global fetch).
//
// Usage:
//   REPLICATE_API_TOKEN=r8_xxx node generate.mjs --prompt "a foggy neon city" \
//     [--model flux|retro|nano] [--aspect square|landscape|portrait] [--out path.webp]
//
//   node generate.mjs --prompt "..." --dry-run   # print the request, spend nothing
//
// Prints a JSON result line: { ok, model, aspect, prompt, path, bytes }

import { writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const MAX_PROMPT_LEN = 2000;
const ASPECTS = ["square", "landscape", "portrait"];
const AR = { square: "1:1", landscape: "16:9", portrait: "3:4" };

// The three MythosForge models, verbatim inputs from the audited x402 handlers.
const MODELS = {
  flux: {
    key: "flux-schnell",
    slug: "black-forest-labs/flux-schnell",
    ext: "webp",
    input: (prompt, aspect) => ({
      prompt, num_outputs: 1, aspect_ratio: AR[aspect],
      output_format: "webp", output_quality: 85, go_fast: true,
    }),
  },
  retro: {
    key: "retro-diffusion",
    slug: "retro-diffusion/rd-plus",
    ext: "png",
    input: (prompt, aspect) => {
      const [width, height] = { square: [256, 256], landscape: [384, 256], portrait: [256, 384] }[aspect];
      return { prompt, style: "default", width, height };
    },
  },
  nano: {
    key: "nano-banana-2",
    slug: "google/nano-banana-2",
    ext: "png",
    input: (prompt, aspect) => ({ prompt, aspect_ratio: AR[aspect], resolution: "2K", output_format: "png" }),
  },
};
// friendly aliases
MODELS["flux-schnell"] = MODELS.flux;
MODELS["retro-diffusion"] = MODELS.retro;
MODELS["rd-plus"] = MODELS.retro;
MODELS["nano-banana-2"] = MODELS.nano;
MODELS["banana"] = MODELS.nano;

function parseArgs(argv) {
  const a = { model: "flux", aspect: "square", prompt: "", out: "", dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (k === "--dry-run") { a.dryRun = true; continue; }
    const v = argv[i + 1];
    if (k === "--prompt") { a.prompt = v; i++; }
    else if (k === "--model") { a.model = v; i++; }
    else if (k === "--aspect") { a.aspect = v; i++; }
    else if (k === "--out") { a.out = v; i++; }
    else if (k === "--help" || k === "-h") { a.help = true; }
  }
  return a;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const fail = (msg) => { console.error(JSON.stringify({ ok: false, error: msg })); process.exit(1); };

function pickUrl(output) {
  if (!output) return null;
  if (typeof output === "string") return output;
  if (Array.isArray(output)) return output.find((x) => typeof x === "string") ?? null;
  if (typeof output === "object" && typeof output.url === "string") return output.url;
  return null;
}

async function waitForImage(token, pred) {
  const deadline = Date.now() + 120_000; // 2 min hard cap
  while (!["succeeded", "failed", "canceled"].includes(pred.status)) {
    if (Date.now() > deadline) throw new Error("timed out after 120s");
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
    console.log("Usage: REPLICATE_API_TOKEN=r8_xxx node generate.mjs --prompt \"...\" [--model flux|retro|nano] [--aspect square|landscape|portrait] [--out path] [--dry-run]");
    return;
  }

  const prompt = (a.prompt ?? "").trim();
  const model = MODELS[a.model];
  if (!prompt) fail("prompt required (--prompt \"...\")");
  if (prompt.length > MAX_PROMPT_LEN) fail(`prompt too long (max ${MAX_PROMPT_LEN})`);
  if (!model) fail(`unknown model '${a.model}' (use flux | retro | nano)`);
  if (!ASPECTS.includes(a.aspect)) fail(`invalid aspect '${a.aspect}' (use ${ASPECTS.join(" | ")})`);

  const input = model.input(prompt, a.aspect);
  const out = resolve(a.out || `out/${model.key}-${a.aspect}.${model.ext}`);

  if (a.dryRun) {
    console.log(JSON.stringify({
      ok: true, dryRun: true, model: model.key, aspect: a.aspect, out,
      request: { endpoint: `https://api.replicate.com/v1/models/${model.slug}/predictions`, input },
    }, null, 2));
    return;
  }

  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) fail("REPLICATE_API_TOKEN not set — export your own Replicate key (https://replicate.com/account/api-tokens)");

  // Fire the prediction with Prefer: wait so short models return inline; poll otherwise.
  const res = await fetch(`https://api.replicate.com/v1/models/${model.slug}/predictions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Prefer: "wait=60" },
    body: JSON.stringify({ input }),
  });
  if (!res.ok) fail(`replicate ${res.status}: ${(await res.text()).slice(0, 200)}`);
  let pred = await res.json();

  const output = pred.status === "succeeded" ? pred.output : await waitForImage(token, pred);
  const url = pickUrl(output);
  if (!url) fail("no image URL in prediction output");

  const img = await fetch(url);
  if (!img.ok) fail(`image download ${img.status}`);
  const bytes = Buffer.from(await img.arrayBuffer());

  await mkdir(dirname(out), { recursive: true });
  await writeFile(out, bytes);
  console.log(JSON.stringify({ ok: true, model: model.key, aspect: a.aspect, prompt, path: out, bytes: bytes.length }));
}

main().catch((err) => fail(err instanceof Error ? err.message : String(err)));
