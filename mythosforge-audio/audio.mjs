#!/usr/bin/env node
// mythosforge-audio — generate audio via Replicate: text-to-speech, music/ambience, or sound
// effects. BYO REPLICATE_API_TOKEN (same key as the generators). Zero npm deps (Node 18+ fetch).
//
// Usage:
//   REPLICATE_API_TOKEN=r8_... node audio.mjs --op tts   --text "Welcome, traveler." [--voice Wise_Woman] [--out out.mp3]
//   REPLICATE_API_TOKEN=r8_... node audio.mjs --op music --text "calm lo-fi rain ambience" --duration 12 [--out out.mp3]
//   REPLICATE_API_TOKEN=r8_... node audio.mjs --op sfx   --text "sword clang, metallic" --duration 3 [--out out.wav]
//   node audio.mjs --op music --text "..." --dry-run   # print the request, no key, no spend
//
// Prints a JSON result line: { ok, op, text, path, bytes }.

import { writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";

// Per-op config. Audio model input fields diverge HARD across ops (this is the map that matters):
//   text field:   `text` (tts) vs `prompt` (music/sfx)
//   duration:     `duration` (music) vs `seconds_total` (sfx) vs none (tts uses text length)
//   format field: `audio_format` (tts) vs `output_format` (music) vs none (sfx -> wav)
//   voice_id:     tts only (default = a MiniMax system voice)
// Verify slugs + fields from https://replicate.com/<owner>/<model>/llms.txt.
export const DEFAULT_VOICE = "Wise_Woman"; // MiniMax speech-02 system voice
export const OPS = {
  tts:   { slug: "minimax/speech-02-turbo",        textField: "text",   fmtField: "audio_format",  defFmt: "mp3", durField: null,            voice: true },
  music: { slug: "meta/musicgen",                  textField: "prompt", fmtField: "output_format", defFmt: "mp3", durField: "duration",      voice: false },
  sfx:   { slug: "stackadoc/stable-audio-open-1.0", textField: "prompt", fmtField: null,           defFmt: "wav", durField: "seconds_total", voice: false },
};

const fail = (msg) => { console.error(JSON.stringify({ ok: false, error: msg })); process.exit(1); };

// --duration (music/sfx), when provided, must be a positive integer (seconds).
export function isValidDuration(d) {
  return d === null || (Number.isInteger(d) && d > 0);
}

// Pure per-op input builder (unit-tested).
export function buildInput(op, text, opts = {}) {
  const input = { [op.textField]: text };
  if (op.voice) input.voice_id = opts.voice || DEFAULT_VOICE;
  if (op.fmtField) input[op.fmtField] = opts.format || op.defFmt;
  if (op.durField && opts.duration != null) input[op.durField] = opts.duration;
  return input;
}

// Output file extension for an op (matches the chosen format where the model supports one).
export function extFor(op, format) {
  return op.fmtField ? (format || op.defFmt) : op.defFmt;
}

export function pickUrl(output) {
  if (!output) return null;
  if (typeof output === "string") return output;
  if (Array.isArray(output)) return output.find((x) => typeof x === "string") ?? null;
  if (typeof output === "object" && typeof output.url === "string") return output.url;
  return null;
}

function parseArgs(argv) {
  const a = { op: "", text: "", voice: "", duration: null, format: "", out: "", slug: "", dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (k === "--dry-run") { a.dryRun = true; continue; }
    if (k === "--help" || k === "-h") { a.help = true; continue; }
    const v = argv[i + 1];
    if (k === "--op") { a.op = v; i++; }
    else if (k === "--text") { a.text = v; i++; }
    else if (k === "--voice") { a.voice = v; i++; }
    else if (k === "--duration") { a.duration = Number(v); i++; }
    else if (k === "--format") { a.format = v; i++; }
    else if (k === "--out") { a.out = v; i++; }
    else if (k === "--model" || k === "--slug") { a.slug = v; i++; }
  }
  return a;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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
  const deadline = Date.now() + 300_000; // audio gen is minutes at most
  while (!["succeeded", "failed", "canceled"].includes(pred.status)) {
    if (Date.now() > deadline) throw new Error("timed out after 300s");
    await sleep(2000);
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
    console.log('Usage: REPLICATE_API_TOKEN=r8_... node audio.mjs --op tts|music|sfx --text "..." [--voice <id> (tts)] [--duration <sec> (music/sfx)] [--format <fmt>] [--out path] [--model <slug>] [--dry-run]');
    return;
  }
  const op = OPS[a.op];
  if (!a.op) fail(`--op required (${Object.keys(OPS).join(" | ")})`);
  if (!op) fail(`unknown op '${a.op}' (use ${Object.keys(OPS).join(" | ")})`);
  const text = (a.text ?? "").trim();
  if (!text) fail('--text "..." required (speech text for tts, or the prompt for music/sfx)');
  if (!isValidDuration(a.duration)) fail("--duration must be a positive integer (seconds)");
  if (a.duration != null && !op.durField) fail(`--duration is not used by op '${a.op}'`);

  const slug = a.slug || op.slug;
  const ext = extFor(op, a.format);
  const out = resolve(a.out || `out/${a.op}.${ext}`);
  const opts = { voice: a.voice, duration: a.duration, format: a.format };

  if (a.dryRun) {
    console.log(JSON.stringify({ ok: true, dryRun: true, op: a.op, text, out, model: slug,
      request: {
        resolve: `GET https://api.replicate.com/v1/models/${slug}`,
        endpoint: `POST https://api.replicate.com/v1/predictions`,
        body: { version: "<latest_version.id resolved from model>", input: buildInput(op, text, opts) },
      } }, null, 2));
    return;
  }

  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) fail("REPLICATE_API_TOKEN not set — export your own Replicate key (https://replicate.com/account/api-tokens)");

  const input = buildInput(op, text, opts);
  const version = await resolveVersion(token, slug);
  const pred = await startPrediction(token, version, input);
  const output = pred.status === "succeeded" ? pred.output : await waitFor(token, pred);
  const url = pickUrl(output);
  if (!url) fail("no audio URL in prediction output");

  const dl = await fetch(url);
  if (!dl.ok) fail(`download ${dl.status}`);
  const bytes = Buffer.from(await dl.arrayBuffer());

  await mkdir(dirname(out), { recursive: true });
  await writeFile(out, bytes);
  console.log(JSON.stringify({ ok: true, op: a.op, text, path: out, bytes: bytes.length }));
}

if (pathToFileURL(process.argv[1] || "").href === import.meta.url) {
  main().catch((err) => fail(err instanceof Error ? err.message : String(err)));
}
