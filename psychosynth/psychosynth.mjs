#!/usr/bin/env node
/*
 * psychosynth.mjs — zero-dependency Node entrypoint for the psychosynth skill.
 *
 * Uses ONLY Node's built-in global `fetch` + JSON. No jq, no curl, no
 * commander, no npm install. Runs on Node >=18 and on bun. This is the
 * portable alternative to the bash + jq workflow scripts, for runtimes where a
 * `jq` binary isn't available or a bundled `jq` shim is broken.
 *
 * Usage (always invoke by a path that is valid from YOUR cwd — in agent
 * sandboxes the working directory is usually NOT the skill folder, so prefer
 * an absolute path, e.g. /tmp/psychosynth.mjs after fetching the canonical
 * copy from $PSYCHOSYNTH_BASE_URL/psychosynth.mjs):
 *   node /path/to/psychosynth.mjs discovery
 *   node /path/to/psychosynth.mjs preview <slug>
 *   node /path/to/psychosynth.mjs query <slug> [querystring]  # set X_PAYMENT for paid
 *   node /path/to/psychosynth.mjs doppler                 # retail resistance sim
 *   node /path/to/psychosynth.mjs guardrails ["trade setup"]  # cognitive-bias screen
 *   node /path/to/psychosynth.mjs negotiation [category]  # counterparty reactions
 *   node /path/to/psychosynth.mjs personalize             # UX config per persona
 *
 * Env: PSYCHOSYNTH_BASE_URL (default https://psychosynth.vercel.app),
 *      X_PAYMENT (base64 x402 header — enables paid mode where relevant).
 *
 * Reliability: free (unpaid) GETs are retried up to 2 extra times on network
 * errors and transient 5xx responses. Paid calls are NEVER auto-retried —
 * replaying a signed X-PAYMENT header after an ambiguous failure risks
 * burning the one-time EIP-3009 authorization.
 */

import { pathToFileURL } from 'node:url';
import { realpathSync } from 'node:fs';

const BASE = (process.env.PSYCHOSYNTH_BASE_URL || 'https://psychosynth.vercel.app').replace(/\/+$/, '');
const XPAY = process.env.X_PAYMENT || '';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getJSON(pathAndQuery, { paid = false } = {}) {
  const headers = { accept: 'application/json' };
  const sendsPayment = paid && !!XPAY;
  if (sendsPayment) headers['X-PAYMENT'] = XPAY;
  // Never auto-retry a request that carries a payment header (see header note).
  const attempts = sendsPayment ? 1 : 3;
  let lastErr = null;
  for (let i = 0; i < attempts; i++) {
    if (i > 0) await sleep(400 * i);
    let res, text;
    try {
      res = await fetch(BASE + pathAndQuery, { headers });
      text = await res.text();
    } catch (e) {
      lastErr = new Error(`network error calling ${pathAndQuery}: ${e.message}`);
      continue;
    }
    if (res.status >= 500 && i < attempts - 1) {
      lastErr = new Error(`${pathAndQuery} returned HTTP ${res.status}`);
      continue;
    }
    let json = null;
    try { json = JSON.parse(text); } catch { /* leave null */ }
    return { status: res.status, json, text };
  }
  throw lastErr || new Error(`request failed: ${pathAndQuery}`);
}

const id8 = (x) => String(x || '').slice(0, 8);
const num = (x) => (x === undefined || x === null ? 'n/a' : x);
// PostgREST embeds are objects today, but to-many shapes come back as arrays.
// Normalize so a server-side join change can't silently break rendering.
const one = (x) => (Array.isArray(x) ? (x[0] ?? null) : (x ?? null));

// ------------------------------------------------------- renderers (pure) ----
export function renderDoppler(json, { paid } = {}) {
  const recs = (json && json.records) || [];
  const out = [];
  if (paid) {
    for (const r of recs) {
      out.push(`persona ${id8(r.id)} | ${r.mbti_label} ${r.decision_style} | loss-aversion lambda=${num(r.content && r.content.prospect_theory && r.content.prospect_theory.lambda)} | neuroticism=${num(r.big_five && r.big_five.neuroticism)}`);
    }
    const t = recs.length;
    const h = recs.filter((r) => ((r.content && r.content.prospect_theory && r.content.prospect_theory.lambda) || 0) >= 2.5).length;
    out.push(`High-resistance personas (lambda>=2.5): ${h}/${t} — these fight the curve on the way down (panic-sell pressure).`);
  } else {
    for (const r of recs) {
      out.push(`persona ${id8(r.id)} | ${r.mbti_label} ${r.decision_style} | neuroticism=${num(r.big_five && r.big_five.neuroticism)} | ${(r.tags || []).join(',')}`);
    }
    const t = recs.length;
    const h = recs.filter((r) => ((r.big_five && r.big_five.neuroticism) || 0) >= 0.6).length;
    out.push(`High-resistance personas (neuroticism>=0.6): ${h}/${t} — proxy for panic-sell pressure into the bonding curve.`);
  }
  return out;
}

export function renderGuardrails(json) {
  const recs = (json && json.records) || [];
  return recs.flatMap((r) => [
    `Bias: ${r.name} (${r.slug})`,
    `  What it is: ${r.description}`,
    `  Example: ${(r.examples || [])[0] ?? 'n/a'}`,
    `  Guardrail: ${(r.mitigations || [])[0] ?? 'n/a'}`,
    '---',
  ]);
}

export function renderNegotiation(json, category) {
  const recs = ((json && json.records) || [])
    .map((r) => ({ ...r, scenarios: one(r.scenarios), profiles: one(r.profiles) }))
    .filter((r) => !category || (r.scenarios && r.scenarios.category === category));
  return recs.flatMap((r) => [
    `Scenario: ${(r.scenarios && r.scenarios.title) ?? 'n/a'} [${(r.scenarios && r.scenarios.category) ?? ''}]`,
    `  Counterparty: ${(r.profiles && r.profiles.mbti_label) ?? '?'} / ${(r.profiles && r.profiles.decision_style) ?? '?'}`,
    `  Reaction: ${r.response}`,
    `  Reasoning: ${r.reasoning_chain}`,
    `  Confidence: ${num(r.confidence)}`,
    '---',
  ]);
}

export function renderPersonalize(json, { paid } = {}) {
  const recs = (json && json.records) || [];
  return recs.map((r) => {
    if (paid) {
      const lam = r.content && r.content.prospect_theory && r.content.prospect_theory.lambda;
      return { user: id8(r.id), mbti: r.mbti_label, loss_aversion_lambda: lam,
        ux_config: lam > 2.0 ? { risk_style: 'conservative', warning_banner: 'high_prominence', signal_style: 'detailed_risk' }
                             : { risk_style: 'aggressive', warning_banner: 'subtle', signal_style: 'action_oriented' } };
    }
    const n = r.big_five && r.big_five.neuroticism;
    return { user: id8(r.id), mbti: r.mbti_label, neuroticism: n,
      ux_config: n > 0.55 ? { risk_style: 'conservative', warning_banner: 'high_prominence', signal_style: 'detailed_risk' }
                          : { risk_style: 'aggressive', warning_banner: 'subtle', signal_style: 'action_oriented' } };
  });
}

// -------------------------------------------------------------- commands -----
async function cmdDiscovery() {
  const { status, json } = await getJSON('/api/v1/discovery');
  if (status !== 200 || !json) throw new Error(`discovery returned HTTP ${status}`);
  console.log(JSON.stringify(json, null, 2));
}

async function cmdPreview(slug) {
  if (!slug) throw new Error('usage: preview <slug>');
  const { status, json, text } = await getJSON(`/api/v1/preview/${slug}`);
  if (status !== 200) throw new Error(`preview/${slug} returned HTTP ${status}: ${text.slice(0, 200)}`);
  console.log(JSON.stringify(json, null, 2));
}

async function cmdQuery(slug, qs) {
  if (!slug) throw new Error('usage: query <slug> [querystring]');
  const path = `/api/v1/query/${slug}${qs ? `?${qs}` : ''}`;
  const paid = !!XPAY;
  const { status, json } = await getJSON(path, { paid });
  if (!paid && status === 402) {
    console.error('No X_PAYMENT set — printing the 402 quote:');
  }
  console.log(JSON.stringify(json, null, 2));
}

async function cmdDoppler() {
  const paid = !!XPAY;
  console.log('=== Doppler Launch Simulation — retail counterparty resistance ===');
  console.log(paid ? 'Paid mode: retail personas with prospect-theory posture (loss aversion lambda).'
                   : 'Free preview mode (neuroticism as loss-aversion proxy; set X_PAYMENT for real lambda).');
  const path = paid ? '/api/v1/query/robinhood-counterparty-pack?lambda_min=2.0&limit=25'
                    : '/api/v1/preview/robinhood-counterparty-pack';
  const { status, json } = await getJSON(path, { paid });
  if (status !== 200) throw new Error(`robinhood-counterparty-pack returned HTTP ${status}`);
  if (!paid) console.log(`Loaded ${(json && json.count) || 0} retail personas.`);
  renderDoppler(json, { paid }).forEach((l) => console.log(l));
  console.log('Simulation complete.');
}

async function cmdGuardrails(setup) {
  console.log('=== Trading Guardrails Check ===');
  console.log(`Analyzing trade setup: "${setup || 'Long position on leverage following a recent price surge'}"`);
  const { status, json } = await getJSON('/api/v1/preview/cognitive-bias-simulator');
  if (status !== 200) throw new Error(`cognitive-bias-simulator returned HTTP ${status}`);
  const n = (json && json.count) || 0;
  if (!n) { console.log('No bias records returned.'); return; }
  console.log(`\n=== Guardrails Report (${n} bias models) ===`);
  renderGuardrails(json).forEach((l) => console.log(l));
  console.log('Guardrails evaluation finished.');
}

async function cmdNegotiation(category) {
  console.log('=== x402 Counterparty Negotiation Simulation ===');
  console.log(`Fetching behavioral responses${category ? ` (category: ${category})` : ''}...`);
  const { status, json } = await getJSON('/api/v1/preview/behavioral-response-library');
  if (status !== 200) throw new Error(`behavioral-response-library returned HTTP ${status}`);
  console.log('\n=== Counterparty Reactions ===');
  renderNegotiation(json, category).forEach((l) => console.log(l));
  console.log('Negotiation simulation complete.');
}

async function cmdPersonalize() {
  const paid = !!XPAY;
  console.log('=== App Personalization Engine ===');
  console.log(paid ? 'Paid mode: tailoring UX from prospect-theory lambda.'
                   : 'Free preview mode (neuroticism as loss-aversion proxy; set X_PAYMENT for real lambda).');
  const path = paid ? '/api/v1/query/personality-profile-library?limit=25'
                    : '/api/v1/preview/personality-profile-library';
  const { status, json } = await getJSON(path, { paid });
  if (status !== 200) throw new Error(`personality-profile-library returned HTTP ${status}`);
  renderPersonalize(json, { paid }).forEach((o) => console.log(JSON.stringify(o, null, 2)));
  console.log('Personalization profiles generated.');
}

const COMMANDS = {
  discovery: cmdDiscovery,
  preview: cmdPreview,
  query: cmdQuery,
  doppler: cmdDoppler,
  guardrails: cmdGuardrails,
  negotiation: cmdNegotiation,
  personalize: cmdPersonalize,
};

async function main() {
  const [cmd, ...args] = process.argv.slice(2);
  const fn = COMMANDS[cmd];
  if (!fn) {
    console.error('usage: node /path/to/psychosynth.mjs <discovery|preview|query|doppler|guardrails|negotiation|personalize> [args]');
    process.exit(2);
  }
  try {
    await fn(...args);
  } catch (e) {
    console.error(`psychosynth: ${e.message}`);
    process.exit(1);
  }
}

// Run only when invoked directly (so the renderers can be imported for tests).
// pathToFileURL + realpath is the robust comparison: a hand-built
// `file://${argv[1]}` URL breaks on percent/hash characters in paths and on
// symlinked installs (import.meta.url is the realpath), silently turning the
// CLI into a no-op that exits 0 with no output.
let invokedDirectly = false;
try {
  if (process.argv[1]) {
    let argPath = process.argv[1];
    try { argPath = realpathSync(argPath); } catch { /* keep as-is */ }
    invokedDirectly = import.meta.url === pathToFileURL(argPath).href;
  }
} catch { invokedDirectly = false; }
if (invokedDirectly) main();
