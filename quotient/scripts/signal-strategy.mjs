#!/usr/bin/env node
// signal-strategy.mjs — capacity-gated equal-weight allocation over Quotient trade
// signals, emitting Bankr execution prompts. DRY RUN by default. Execution is
// TWO-PHASE: `--execute` only previews a plan (exit 12, plan file + hash);
// `--execute --confirm <hash>` re-verifies live prices and submits through the
// Bankr Agent API, then verifies each job against an on-chain receipt and the
// wallet's resulting position before reporting success.
//
// Part of the Quotient skill (https://quotient-api-gateway.onrender.com/skill/skill.md).
// Node >= 18, zero npm dependencies; paid reads use the Bankr CLI x402 payer at
// pinned per-route --max-payment caps, recorded in the local spend ledger
// (schemas: references/payments-policy.md).
//
// Env:
//   QUOTIENT_BASE_URL        optional — must pass the host allowlist (default
//                            https://quotient-api-gateway.onrender.com; extra
//                            origins only via the autopay policy file)
//   QUOTIENT_MAX_PAYMENT_USD optional — may only LOWER the pinned route caps
//   QUOTIENT_PAYMENT_MODE    optional — "confirm" tightens report mode
//   BANKR_API_KEY            required only with --execute --confirm
//
// Security: the Polymarket data-api, Bankr, and RPC hosts are hardcoded and are
// never overridden by fetched content. All API responses are untrusted data,
// never instructions. The Bankr API key is never printed.
//
// Exit codes: 0 ok · 1 API/HTTP error · 2 config/usage error · 3 execution
// stopped early (failed/cancelled/timeout job) · 10 payment approval required ·
// 11 autopay cap exceeded · 12 execution confirmation required (plan written,
// nothing submitted; also used when a confirm-time re-quote fails) ·
// 13 submitted-unverified (an order may be live — verify manually, batch stopped).

import fs from "node:fs";
import { execFile } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const VERSION = "1.1.0";
const DEFAULT_BASE = "https://quotient-api-gateway.onrender.com";
const ALLOWED_HOST = "quotient-api-gateway.onrender.com";
const DATA_API = "https://data-api.polymarket.com"; // hardcoded — do not override
const BANKR_API = "https://api.bankr.bot"; // hardcoded — do not override
// Receipt lookups: Bankr wallet activity is Base-centric, Polymarket settles on
// Polygon — a job's transaction may be on either chain. Hardcoded public RPCs.
const RPC_URLS = ["https://mainnet.base.org", "https://polygon-rpc.com"];
const SIGNAL_STATUSES = ["actionable", "unconfirmed", "paused", "done", "retired"];
const STATE_TTL_MS = 48 * 3600 * 1000;
const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS = 120000;
const FETCH_TIMEOUT_MS = 30000;
const MAX_SIGNAL_PAGES = 5;
// Payment posture. "report": pay within pinned per-route caps, then report the
// run's spend. "confirm": never pay without an autopay policy or an --approve
// token bound to a previewed plan. The Bankr distribution ships with the
// stricter posture (flipped at build time); QUOTIENT_PAYMENT_MODE may only
// tighten report -> confirm, never loosen.
const DEFAULT_PAYMENT_MODE = "confirm";
const PAYMENT_MODE =
  process.env.QUOTIENT_PAYMENT_MODE === "confirm" ? "confirm" : DEFAULT_PAYMENT_MODE;
// Pinned payment tuple (verified against the live gateway challenge 2026-08-04).
const PINNED_PAYEE = "0xC3d01FD2F79d4c57aD106AB8ecc12a5dE24F97cB";
const PINNED_USDC_ASSET = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"; // Base USDC, eip155:8453
const PINNED_USDG_ASSET = "0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168"; // Robinhood Chain USDG, eip155:4663
const PINNED_MAX_TIMEOUT_SECONDS = 300;
// Published per-route prices (USD) — must match payments.sh and
// api-reference.md. Live-read anything informational; pin anything that
// bounds spending: each paid call's cap is the LIVE price from a free
// 402-challenge pre-flight (which also validates the pinned tuple), clamped
// to a CEILING of 2x the published price; the published price is the
// fallback when the pre-flight is unavailable.
const ROUTE_PRICE_USD = {
  "/api/v1/markets/mispriced": 0.05,
  "/api/v1/markets/lookup": 0.005,
  "/api/v1/markets/{slug}/forecast": 0.01,
  "/api/v1/markets/{slug}/intelligence": 0.025,
  "/api/v1/markets/{slug}/signals": 0.025,
  "/api/v1/markets": 0.005,
  "/api/v1/sources": 0.01,
  "/api/v1/signals/featured": 0.01,
  "/api/v1/signals/oil": 0.025,
  "/api/v1/signals": 0.02,
  "/api/v1/portfolio": 0.0025,
  "/api/v1/narratives": 0.01,
  "/api/v1/signal-score": 0.005,
};
const PLAN_TTL_MS = 10 * 60 * 1000; // --confirm must land within 10 min of the preview
const MAX_COST_DRIFT_CENTS = 2; // confirm-time re-quote tolerance vs the previewed ask
const FRESH_MAX_AGE_MS = 6 * 3600 * 1000;
const execFileAsync = promisify(execFile);
const PM_SH = path.join(path.dirname(fileURLToPath(import.meta.url)), "pm.sh");
const LIQUIDITY_NOTICE =
  "Capacity is observed notional within 2 cents of touch, not a guaranteed fill or exact price-impact estimate. A market order can walk the book; recheck the live book and venue preview before approval, especially for volume-fallback or stale snapshots.";
const RISK_DISCLOSURE =
  "Risk disclosure: prediction markets and perpetual futures can lose some or all funds committed. Quotient output is informational research, not investment advice. Prediction markets carry liquidity, resolution/dispute, and oracle/venue risk; perps add leverage, funding, and liquidation risk.";
// Job responses are scanned for venue/scanner rejections that a bare
// "completed" status hides. Any match means the trade must NOT be treated as
// executed.
const JOB_FAILURE_MARKERS = [
  "untrusted_address",
  "blocked_address",
  "not allowed",
  "unable to",
  "insufficient",
  "rejected",
  "failed",
];
// Slugs are interpolated into Bankr prompts — only accept benign shapes so a
// hostile API response can never smuggle instructions into an executed prompt.
const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,127}$/;
const CONDITION_RE = /^0x[0-9a-fA-F]{64}$/;

const CONFIG_DIR = path.join(
  process.env.XDG_CONFIG_HOME || path.join(os.homedir(), ".config"),
  "quotient-skill"
);
const STATE_DIR = path.join(
  process.env.XDG_STATE_HOME || path.join(os.homedir(), ".local", "state"),
  "quotient-skill"
);
const STATE_FILE = path.join(STATE_DIR, "strategy.json");
const POLICY_FILE = path.join(CONFIG_DIR, "autopay.json");
const LEDGER_FILE = path.join(STATE_DIR, "spend-ledger.json");
const PENDING_FILE = path.join(STATE_DIR, "pending-approval.json");
const EXEC_PLAN_FILE = path.join(STATE_DIR, "exec-plan.json");

const USAGE = `Usage: signal-strategy.mjs --wallet 0x... --budget <usd> [options]

Equal-weight allocation across recent Quotient trade signals, capped at 10% of
each market's near-touch capacity, idempotent against current Polymarket
holdings and recently emitted prompts. DRY RUN by default: prints the plan and
the Bankr prompts, submits nothing, writes no state.

Execution is two-phase:
  --execute                 build a hardened plan (actionable + fresh +
                            live-priced + depth-backed signals only), cross-check
                            each market's outcome token and live book via pm.sh,
                            write the plan file, print the preview + risk
                            disclosure, and exit 12. Nothing is submitted.
  --execute --confirm HASH  load the plan (10-minute TTL), verify the hash, re-
                            quote every book within tolerance, then submit via
                            the Bankr Agent API. Success is reported only after
                            an on-chain receipt and a position change are seen;
                            otherwise the batch stops (exit 13, verify manually).

Options:
  --wallet 0x..        Polymarket wallet (required; used to skip already-held markets)
  --budget N           Total USD to allocate (required, > 0)
  --min-conviction N   Minimum conviction tier 1-3 (default 2)
  --status LIST        Comma-set of ${SIGNAL_STATUSES.join("|")} (default actionable;
                       --execute allows only actionable)
  --min-capacity N     Minimum near-touch capacity in USD (default 500)
  --max-positions N    Maximum positions to open (default 5)
  --window N           Latest-forecast lookback in hours, 1-168 (default 24)
  --json               Machine-readable output only
  --preview            Print the paid-call plan + cost and exit 10 without paying
  --approve TOKEN      Run a previously previewed paid-call plan (15-min token)
  --execute            Phase 1: preview the trade plan (exit 12)
  --confirm HASH       Phase 2: submit the previously previewed plan
  --version            Print version and exit
  --help               This text

Env: QUOTIENT_BASE_URL (allowlisted), QUOTIENT_MAX_PAYMENT_USD (lower-only),
     QUOTIENT_PAYMENT_MODE. BANKR_API_KEY is required only with --confirm.`;

function die(code, msg) {
  process.stderr.write(`signal-strategy: ${msg}\n`);
  process.exit(code);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseArgs(argv) {
  const opts = {
    wallet: null,
    budget: null,
    minConviction: 2,
    statuses: ["actionable"],
    minCapacity: 500,
    maxPositions: 5,
    windowHours: 24,
    json: false,
    execute: false,
    preview: false,
    approveToken: null,
    confirmHash: null,
  };
  const next = (i, flag) => {
    if (i + 1 >= argv.length) die(2, `${flag} requires a value\n\n${USAGE}`);
    return argv[i + 1];
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    switch (a) {
      case "--wallet":
        opts.wallet = next(i, a);
        i++;
        break;
      case "--budget":
        opts.budget = Number(next(i, a));
        i++;
        break;
      case "--min-conviction":
        opts.minConviction = Number(next(i, a));
        i++;
        break;
      case "--status":
        opts.statuses = next(i, a)
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
        i++;
        break;
      case "--min-capacity":
        opts.minCapacity = Number(next(i, a));
        i++;
        break;
      case "--max-positions":
        opts.maxPositions = Number(next(i, a));
        i++;
        break;
      case "--window":
        opts.windowHours = Number(next(i, a));
        i++;
        break;
      case "--json":
        opts.json = true;
        break;
      case "--preview":
        opts.preview = true;
        break;
      case "--approve":
        opts.approveToken = next(i, a);
        i++;
        break;
      case "--execute":
        opts.execute = true;
        break;
      case "--confirm":
        opts.confirmHash = next(i, a);
        i++;
        break;
      case "--version":
        process.stdout.write(`signal-strategy.mjs ${VERSION}\n`);
        process.exit(0);
        break;
      case "--help":
      case "-h":
        process.stdout.write(`${USAGE}\n`);
        process.exit(0);
        break;
      default:
        die(2, `unknown argument: ${a}\n\n${USAGE}`);
    }
  }
  if (!opts.wallet || !/^0x[0-9a-fA-F]{40}$/.test(opts.wallet)) {
    die(2, `--wallet must be a 0x-prefixed 40-hex Polymarket address\n\n${USAGE}`);
  }
  opts.wallet = opts.wallet.toLowerCase();
  if (!Number.isFinite(opts.budget) || opts.budget <= 0) {
    die(2, `--budget must be a positive USD amount\n\n${USAGE}`);
  }
  if (!Number.isInteger(opts.minConviction) || opts.minConviction < 1 || opts.minConviction > 3) {
    die(2, "--min-conviction must be 1, 2, or 3");
  }
  const badStatus = opts.statuses.filter((s) => !SIGNAL_STATUSES.includes(s));
  if (!opts.statuses.length || badStatus.length) {
    die(2, `--status must be a comma-set of: ${SIGNAL_STATUSES.join(", ")}`);
  }
  if (!Number.isFinite(opts.minCapacity) || opts.minCapacity < 0) {
    die(2, "--min-capacity must be a non-negative USD amount");
  }
  if (!Number.isInteger(opts.maxPositions) || opts.maxPositions < 1) {
    die(2, "--max-positions must be a positive integer");
  }
  if (!Number.isInteger(opts.windowHours) || opts.windowHours < 1 || opts.windowHours > 168) {
    die(2, "--window must be an integer between 1 and 168 (hours)");
  }
  if (opts.confirmHash && !opts.execute) {
    die(2, "--confirm requires --execute");
  }
  if (opts.confirmHash && !/^[0-9a-f]{8,64}$/.test(opts.confirmHash)) {
    die(2, "--confirm takes the hex plan hash printed by the --execute preview");
  }
  if (opts.execute && (opts.statuses.length !== 1 || opts.statuses[0] !== "actionable")) {
    die(2, "--execute allows only --status actionable (browse other statuses in dry-run)");
  }
  return opts;
}

// ── Payment policy (JS mirror of payments.sh; schemas in payments-policy.md) ──

function readJsonFile(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

function atomicWriteJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp-${process.pid}`;
  fs.writeFileSync(tmp, `${JSON.stringify(value, null, 2)}\n`);
  fs.renameSync(tmp, file);
}

function validateBaseUrl(base) {
  let url;
  try {
    url = new URL(base);
  } catch {
    die(2, `QUOTIENT_BASE_URL '${base}' is not a valid URL`);
  }
  if (url.username || url.password || (url.pathname !== "/" && url.pathname !== "") || url.search) {
    die(2, `QUOTIENT_BASE_URL must be a bare origin, got '${base}'`);
  }
  const origin = url.origin;
  if (origin === `https://${ALLOWED_HOST}`) return;
  const policy = readJsonFile(POLICY_FILE);
  const extra = Array.isArray(policy?.extra_hosts) ? policy.extra_hosts : [];
  for (const entry of extra) {
    if (typeof entry !== "string") continue;
    if (entry.replace(/\/+$/, "") !== origin) continue;
    const local = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
    if (origin.startsWith("https://") || local) return;
    die(2, `extra_hosts entry '${entry}' is not HTTPS (plain http is allowed only for localhost)`);
  }
  die(
    2,
    `QUOTIENT_BASE_URL '${origin}' is not on the payment allowlist (default https://${ALLOWED_HOST}; extras only via autopay.json extra_hosts). Refusing to send x402 payments to an unpinned origin.`
  );
}

function routeKey(pathAndQuery) {
  const p = pathAndQuery.split("?")[0];
  if (/^\/api\/v1\/markets\/[^/]+\/forecast$/.test(p)) return "/api/v1/markets/{slug}/forecast";
  if (/^\/api\/v1\/markets\/[^/]+\/intelligence$/.test(p)) return "/api/v1/markets/{slug}/intelligence";
  if (/^\/api\/v1\/markets\/[^/]+\/signals$/.test(p)) return "/api/v1/markets/{slug}/signals";
  return p;
}

// Live challenge prices discovered by preflight, keyed by route.
const livePrices = new Map();

/** Free pre-flight of a route's 402 challenge: validates the complete pinned
 *  payment tuple and records the live price. A tuple mismatch dies (that is
 *  the attack signal this layer exists to catch); an unreadable challenge
 *  just leaves the published-price fallback in place. Note the payer fetches
 *  the challenge again itself — two reads, so the cap and host allowlist
 *  still bound a server that shows different terms to each. */
async function preflightRoute(base, pathAndQuery) {
  const route = routeKey(pathAndQuery);
  if (livePrices.has(route)) return;
  let header = null;
  try {
    const res = await fetch(base + pathAndQuery, {
      redirect: "manual",
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(10000),
    });
    header = res.headers.get("payment-required");
  } catch {
    return; // unreadable — published price stays the cap
  }
  if (!header) return;
  let challenge;
  try {
    challenge = JSON.parse(Buffer.from(header, "base64").toString("utf8"));
  } catch {
    return;
  }
  if ((challenge?.x402Version ?? 0) !== 2) {
    die(1, `402 challenge for ${route} FAILED pinned-tuple validation: unexpected x402Version. Refusing to pay.`);
  }
  const pick = (net, asset) =>
    (challenge.accepts || []).find(
      (o) =>
        o?.scheme === "exact" &&
        o?.network === net &&
        String(o?.asset || "").toLowerCase() === asset.toLowerCase()
    );
  const offer = pick("eip155:8453", PINNED_USDC_ASSET) || pick("eip155:4663", PINNED_USDG_ASSET);
  const fail = (why) =>
    die(1, `402 challenge for ${route} FAILED pinned-tuple validation: ${why}. Refusing to pay — this origin's payment terms do not match Quotient's pinned payee/asset/network.`);
  if (!offer) fail("no accepts entry matches the pinned scheme/network/asset");
  if (String(offer.payTo || "").toLowerCase() !== PINNED_PAYEE.toLowerCase()) {
    fail(`payTo ${offer.payTo ?? "absent"} is not the pinned Quotient payee`);
  }
  if ((offer.maxTimeoutSeconds ?? 0) > PINNED_MAX_TIMEOUT_SECONDS) {
    fail("maxTimeoutSeconds exceeds the pinned bound");
  }
  if (!/^\d+$/.test(String(offer.amount ?? ""))) {
    fail("amount is not a positive atomic-unit integer");
  }
  livePrices.set(route, Number(offer.amount) / 1e6);
}

function routePrice(pathAndQuery) {
  const key = routeKey(pathAndQuery);
  const published = ROUTE_PRICE_USD[key];
  if (published == null) {
    die(2, `no pinned price for route ${key} — refusing to pay an unknown amount`);
  }
  const policy = readJsonFile(POLICY_FILE);
  const override = policy?.route_overrides?.[key]?.max_payment_usd;
  let ceiling = typeof override === "number" && override > 0 ? override : published * 2;
  let price = published;
  const live = livePrices.get(key);
  if (live != null) {
    if (live > ceiling) {
      die(
        1,
        `live price $${live} for ${key} exceeds the pinned ceiling $${ceiling} — refusing to pay. If this raise is legitimate, accept it explicitly via a route_overrides entry in autopay.json.`
      );
    }
    price = live;
  }
  const env = Number(process.env.QUOTIENT_MAX_PAYMENT_USD);
  if (Number.isFinite(env) && env > 0 && env < price) price = env;
  return price;
}

function ledgerRead() {
  const ledger = readJsonFile(LEDGER_FILE);
  if (ledger && Array.isArray(ledger.entries)) return ledger;
  return { version: 1, lifetime_spent_usd: 0, entries: [] };
}

function ledgerDayTotal() {
  const day = new Date().toISOString().slice(0, 10);
  return ledgerRead()
    .entries.filter((e) => e.status === "paid" && String(e.ts || "").startsWith(day))
    .reduce((sum, e) => sum + (e.charged_usd_estimate || 0), 0);
}

const spend = { runId: `r-${Date.now()}-${process.pid}`, calls: 0, totalUsd: 0, approval: "report-mode" };

function ledgerAppend(route, url, cap, attempt, status) {
  const ledger = ledgerRead();
  ledger.entries.push({
    ts: new Date().toISOString(),
    run_id: spend.runId,
    route,
    url,
    max_payment_usd: cap,
    charged_usd_estimate: status === "paid" ? cap : 0,
    approval: spend.approval,
    attempt,
    status,
  });
  if (status === "paid") ledger.lifetime_spent_usd = (ledger.lifetime_spent_usd || 0) + cap;
  const cutoff = Date.now() - 30 * 86400 * 1000;
  ledger.entries = ledger.entries.filter((e) => Date.parse(e.ts || 0) > cutoff);
  atomicWriteJson(LEDGER_FILE, ledger);
}

function planCallsJson(paymentPlan) {
  return paymentPlan.map((c) => ({
    route: c.route,
    count_max: c.count,
    max_payment_usd: c.price,
    subtotal_usd: Math.round(c.count * c.price * 10000) / 10000,
  }));
}

function planTotal(paymentPlan) {
  return Math.round(paymentPlan.reduce((sum, c) => sum + c.count * c.price, 0) * 10000) / 10000;
}

function policyViolations(policy, paymentPlan) {
  const a = policy?.autopay ?? {};
  const out = [];
  const total = planTotal(paymentPlan);
  if (!a.enabled) out.push("autopay_disabled");
  if (a.expires_at && Date.parse(a.expires_at) < Date.now()) out.push("policy_expired");
  if (paymentPlan.some((c) => c.price > (a.per_call_max_usd ?? Infinity))) out.push("per_call_max_usd");
  if (total > (a.per_run_max_usd ?? Infinity)) out.push("per_run_max_usd");
  if (ledgerDayTotal() + total > (a.per_day_max_usd ?? Infinity)) out.push("per_day_max_usd");
  if (a.total_budget_usd != null) {
    const sinceInit = ledgerRead().lifetime_spent_usd - (policy.lifetime_spent_at_init_usd || 0);
    if (sinceInit + total > a.total_budget_usd) out.push("total_budget_usd");
  }
  return out;
}

function emitPaymentPreview(reason, command, paymentPlan, violations) {
  const policy = readJsonFile(POLICY_FILE);
  const token = `qpay-${new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14)}-${randomBytes(4).toString("hex")}`;
  atomicWriteJson(PENDING_FILE, {
    token,
    created_at: new Date().toISOString(),
    command,
    calls: planCallsJson(paymentPlan),
    total_max_usd: planTotal(paymentPlan),
  });
  const preview = {
    type: "payment_preview",
    reason,
    mode: PAYMENT_MODE,
    command,
    calls: planCallsJson(paymentPlan),
    total_max_usd: planTotal(paymentPlan),
    today_spent_usd: Math.round(ledgerDayTotal() * 10000) / 10000,
    caps: policy?.autopay ?? null,
    cap_violations: violations,
    approval_token: token,
    approve_with: `re-run the same command with --approve ${token}`,
    preauth_offer:
      policy == null
        ? {
            amount_usd: 1.0,
            covers_requests_like_this:
              planTotal(paymentPlan) > 0 ? Math.floor(1.0 / planTotal(paymentPlan)) : null,
            create_with: "./scripts/quotient.sh autopay init --total-budget 1.00",
          }
        : null,
    warnings: [],
  };
  process.stdout.write(`${JSON.stringify(preview, null, 2)}\n`);
  process.stderr.write(
    `signal-strategy: payment preview — nothing was paid. Worst case $${preview.total_max_usd} (${preview.calls
      .map((c) => `${c.route} × up to ${c.count_max} @ $${c.max_payment_usd}`)
      .join(", ")}). Approve: re-run with --approve ${token} (valid 15 min).\n`
  );
}

function gatePayments(command, paymentPlan, opts) {
  if (opts.preview) {
    emitPaymentPreview("approval_required", command, paymentPlan, []);
    process.exit(10);
  }
  if (opts.approveToken) {
    const pending = readJsonFile(PENDING_FILE);
    if (!pending || pending.token !== opts.approveToken) {
      die(2, "approval token does not match the pending preview — re-run without --approve for a fresh one");
    }
    if (Date.parse(pending.created_at) < Date.now() - 15 * 60 * 1000) {
      die(2, "approval token expired (15 min) — re-run without --approve for a fresh preview");
    }
    const canon = (calls) =>
      JSON.stringify(
        calls
          .map((c) => ({ route: c.route, count_max: c.count_max, max_payment_usd: c.max_payment_usd }))
          .sort((x, y) => (x.route < y.route ? -1 : 1))
      );
    if (canon(pending.calls || []) !== canon(planCallsJson(paymentPlan))) {
      die(2, "the call plan changed since the approved preview — re-run without --approve to re-preview");
    }
    fs.rmSync(PENDING_FILE, { force: true });
    spend.approval = "user-token";
    return;
  }
  const policy = readJsonFile(POLICY_FILE);
  if (policy != null) {
    const violations = policyViolations(policy, paymentPlan);
    if (violations.length === 0) {
      spend.approval = "autopay";
      return;
    }
    emitPaymentPreview("cap_exceeded", command, paymentPlan, violations);
    process.exit(11);
  }
  if (PAYMENT_MODE === "confirm") {
    emitPaymentPreview("approval_required", command, paymentPlan, []);
    process.exit(10);
  }
  spend.approval = "report-mode";
}

function reportSpend() {
  if (spend.calls > 0) {
    process.stderr.write(
      `signal-strategy: paid calls this run: ${spend.calls} ($${spend.totalUsd.toFixed(4)} at live challenge prices under the pinned ceilings; approval: ${spend.approval}). Today: $${ledgerDayTotal().toFixed(4)} total. Surface this cost to the user.\n`
    );
  }
}

// ── HTTP helpers ──────────────────────────────────────────────────────────────

const paidMemo = new Map();
let paidPlanTotal = 0;

async function quotientGet(base, pathAndQuery) {
  const url = base + pathAndQuery;
  if (paidMemo.has(url)) return paidMemo.get(url);
  const price = routePrice(pathAndQuery);
  const route = routeKey(pathAndQuery);
  for (let attempt = 1; attempt <= 2; attempt++) {
    if (Math.round((spend.totalUsd + price) * 10000) / 10000 > paidPlanTotal) {
      die(1, `retry for ${pathAndQuery.split("?")[0]} would exceed the approved run total ($${paidPlanTotal}) — stopping`);
    }
    let stdout;
    try {
      ({ stdout } = await execFileAsync(
        "bankr",
        ["x402", "call", url, "--max-payment", String(price), "--yes", "--raw"],
        { timeout: FETCH_TIMEOUT_MS, maxBuffer: 10 * 1024 * 1024 }
      ));
      const body = JSON.parse(stdout);
      ledgerAppend(route, url, price, attempt, "paid");
      spend.calls += 1;
      spend.totalUsd = Math.round((spend.totalUsd + price) * 10000) / 10000;
      paidMemo.set(url, body);
      return body;
    } catch (err) {
      if (err.code === "ENOENT") {
        die(2, "Bankr CLI is required for x402 reads. Install @bankr/cli and log in.");
      }
      ledgerAppend(route, url, price, attempt, "failed");
      if (attempt === 1) {
        process.stderr.write(
          "signal-strategy: x402 request failed — retrying once (if the failure happened after payment this may double-charge; check the spend ledger).\n"
        );
        await sleep(2000);
      } else {
        die(1, `x402 request failed for ${pathAndQuery.split("?")[0]}: ${err.message}`);
      }
    }
  }
  return null; // unreachable
}

async function fetchSignals(base, opts) {
  const signals = [];
  let cursor = null;
  for (let page = 0; page < MAX_SIGNAL_PAGES; page++) {
    const params = new URLSearchParams({
      window: String(opts.windowHours),
      status: opts.statuses.join(","),
      min_conviction: String(opts.minConviction),
      min_capacity_usd: String(opts.minCapacity),
      limit: "50",
    });
    if (cursor) params.set("cursor", cursor);
    const body = await quotientGet(base, `/api/v1/signals?${params}`);
    signals.push(...(Array.isArray(body.signals) ? body.signals : []));
    if (!body.has_more || !body.next_cursor) break;
    cursor = body.next_cursor;
  }
  return signals;
}

/** Held set from the Polymarket data-api, keyed `conditionId:outcome` (lowercased).
 *  Fail-closed: an unreadable holdings list means no plan (never risk a re-buy). */
async function fetchHeldSet(wallet) {
  const held = new Set();
  for (let offset = 0; offset <= 1500; offset += 500) {
    const url = `${DATA_API}/positions?user=${wallet}&limit=500&offset=${offset}&sizeThreshold=1`;
    let res;
    try {
      res = await fetch(url, {
        headers: { accept: "application/json" },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
    } catch (err) {
      die(1, `Polymarket data-api unreachable (${err.message}) — refusing to plan without a holdings check.`);
    }
    if (!res.ok) {
      die(1, `Polymarket data-api error ${res.status} — refusing to plan without a holdings check.`);
    }
    let page;
    try {
      page = await res.json();
    } catch {
      die(1, "Polymarket data-api returned invalid JSON — refusing to plan without a holdings check.");
    }
    if (!Array.isArray(page)) die(1, "unexpected Polymarket data-api response shape");
    for (const p of page) {
      if (p?.conditionId && p?.outcome) {
        held.add(`${p.conditionId}:${String(p.outcome).toLowerCase()}`);
      }
    }
    if (page.length < 500) break;
  }
  return held;
}

/** Size of the wallet's position in one (condition, outcome), 0 when absent.
 *  Returns null when the data-api read fails (verification degrades, never lies). */
async function positionSize(wallet, conditionId, outcome) {
  const url = `${DATA_API}/positions?user=${wallet}&market=${conditionId}&limit=100&sizeThreshold=0`;
  try {
    const res = await fetch(url, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const page = await res.json();
    if (!Array.isArray(page)) return null;
    const row = page.find(
      (p) =>
        String(p?.conditionId || "").toLowerCase() === conditionId.toLowerCase() &&
        String(p?.outcome || "").toLowerCase() === outcome.toLowerCase()
    );
    return row ? Number(row.size) || 0 : 0;
  } catch {
    return null;
  }
}

/** Outcome-aware live book read through the vendored pm.sh (condition-verified). */
async function bookRead(slug, side, conditionId) {
  try {
    const { stdout } = await execFileAsync(
      PM_SH,
      ["book", slug, "--side", side.toLowerCase(), "--expect-condition", conditionId, "--json"],
      { timeout: FETCH_TIMEOUT_MS, maxBuffer: 1024 * 1024 }
    );
    const book = JSON.parse(stdout);
    if (!book?.token_id || !/^\d+$/.test(String(book.token_id))) return { error: "no_token" };
    return book;
  } catch (err) {
    // pm.sh exit 1 covers condition_id mismatch; exit 2 covers non-binary markets.
    return { error: err.code === 1 ? "condition_mismatch" : "book_unavailable" };
  }
}

// ── Local emit-state (idempotency between prompt emission and fill visibility) ─

function loadState(nowMs) {
  let raw;
  try {
    raw = fs.readFileSync(STATE_FILE, "utf8");
  } catch (err) {
    if (err?.code === "ENOENT") return [];
    die(1, `corrupt or unreadable state file ${STATE_FILE} — refusing to plan; inspect or delete it to proceed.`);
  }
  let entries;
  try {
    entries = JSON.parse(raw);
  } catch {
    die(1, `corrupt or unreadable state file ${STATE_FILE} — refusing to plan; inspect or delete it to proceed.`);
  }
  if (!Array.isArray(entries)) {
    die(1, `corrupt or unreadable state file ${STATE_FILE} — refusing to plan; inspect or delete it to proceed.`);
  }
  return entries.filter(
    (e) => e && typeof e.emittedAt === "string" && nowMs - Date.parse(e.emittedAt) < STATE_TTL_MS
  );
}

function saveState(entries) {
  fs.mkdirSync(STATE_DIR, { recursive: true });
  const tmp = `${STATE_FILE}.tmp-${process.pid}`;
  fs.writeFileSync(tmp, `${JSON.stringify(entries, null, 2)}\n`);
  fs.renameSync(tmp, STATE_FILE);
}

// ── Bankr Agent API (only with --execute --confirm) ───────────────────────────

async function bankrSubmit(bankrKey, prompt) {
  let res;
  try {
    res = await fetch(`${BANKR_API}/agent/prompt`, {
      method: "POST",
      headers: { "X-API-Key": bankrKey, "content-type": "application/json" },
      body: JSON.stringify({ prompt }),
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
  } catch (err) {
    return { error: `Bankr API unreachable: ${err.message}` };
  }
  let body = null;
  try {
    body = await res.json();
  } catch {
    /* handled below */
  }
  if (!res.ok || !body?.jobId) {
    return { error: `Bankr submit failed (HTTP ${res.status})` };
  }
  return { jobId: body.jobId };
}

/** Poll until the job reaches a terminal status; returns { status, body }. */
async function pollJob(bankrKey, jobId) {
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  let body = null;
  while (Date.now() < deadline) {
    await sleep(POLL_INTERVAL_MS);
    let res;
    try {
      res = await fetch(`${BANKR_API}/agent/job/${jobId}`, {
        headers: { "X-API-Key": bankrKey, accept: "application/json" },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
    } catch {
      continue; // transient — keep polling until the deadline
    }
    if (!res.ok) continue;
    try {
      body = await res.json();
    } catch {
      continue;
    }
    if (["completed", "failed", "cancelled"].includes(body?.status)) {
      return { status: body.status, body };
    }
  }
  return { status: "timeout", body };
}

async function rpcGetReceipt(rpcUrl, txHash) {
  try {
    const res = await fetch(rpcUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "eth_getTransactionReceipt",
        params: [txHash],
      }),
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const body = await res.json();
    return body?.result ?? null;
  } catch {
    return null;
  }
}

/** Verify a completed Bankr job did what the trade intended. Never trusts the
 *  bare status: requires a mined receipt AND a visible position increase for
 *  "executed-verified"; anything less is "submitted-unverified" (stop + check).
 */
async function verifyJob(bankrKey, jobBody, trade, preSize, wallet) {
  const text = JSON.stringify(jobBody ?? {});
  const lower = text.toLowerCase();
  const marker = JOB_FAILURE_MARKERS.find((m) => lower.includes(m));
  if (marker) {
    return { outcome: "failed", detail: `job response contains "${marker}"` };
  }

  const detail = [];
  const known = new Set([trade.condition_id.toLowerCase()]);
  const hashes = [...new Set((text.match(/0x[0-9a-fA-F]{64}/g) || []).map((h) => h.toLowerCase()))].filter(
    (h) => !known.has(h)
  );

  let receiptOk = false;
  if (hashes.length === 0) {
    detail.push("no transaction hash in the job response");
  } else {
    outer: for (let round = 0; round < 8 && !receiptOk; round++) {
      for (const hash of hashes) {
        for (const rpc of RPC_URLS) {
          const receipt = await rpcGetReceipt(rpc, hash);
          if (receipt) {
            if (receipt.status === "0x1") {
              receiptOk = true;
              detail.push(`receipt mined (${rpc.includes("base") ? "base" : "polygon"}: ${hash.slice(0, 10)}…)`);
              break outer;
            }
            return { outcome: "failed", detail: `transaction ${hash.slice(0, 10)}… reverted on-chain` };
          }
        }
      }
      await sleep(3000);
    }
    if (!receiptOk) detail.push("no mined receipt found on Base or Polygon within the wait window");
  }

  let positionOk = false;
  if (preSize == null) {
    detail.push("pre-trade position unreadable — position delta unverifiable");
  } else {
    for (let round = 0; round < 6 && !positionOk; round++) {
      await sleep(10000);
      const size = await positionSize(wallet, trade.condition_id, trade.outcome);
      if (size != null && size > preSize) {
        positionOk = true;
        detail.push(`position grew ${preSize} → ${size} ${trade.outcome} shares`);
      }
    }
    if (!positionOk) detail.push(`no ${trade.outcome} position increase visible for --wallet within 60s`);
  }

  // The Bankr agent may trade from a different wallet than --wallet; surface it.
  try {
    const res = await fetch(`${BANKR_API}/agent/me`, {
      headers: { "X-API-Key": bankrKey, accept: "application/json" },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (res.ok) {
      const me = await res.json();
      const bw = String(me?.walletAddress || "").toLowerCase();
      if (bw && bw !== wallet) {
        detail.push(`Bankr wallet ${bw.slice(0, 10)}… differs from --wallet — position check may miss the fill`);
      }
    }
  } catch {
    /* advisory only */
  }

  if (receiptOk && positionOk) return { outcome: "executed-verified", detail: detail.join("; ") };
  return { outcome: "submitted-unverified", detail: detail.join("; ") };
}

// ── Formatting ────────────────────────────────────────────────────────────────

const fmtUsd = (n) => `$${n.toFixed(2).replace(/\.00$/, "")}`;
const trunc = (s, n) => (s.length > n ? s.slice(0, n) : s);

function printTable(rows) {
  const fmt = (c) =>
    [
      c[0].padEnd(22),
      c[1].padEnd(36),
      c[2].padEnd(5),
      c[3].padEnd(5),
      c[4].padStart(8),
      c[5].padStart(9),
      c[6].padStart(8),
      `  ${c[7]}`,
    ].join(" ");
  process.stdout.write(
    `${fmt(["SIGNAL", "MARKET", "SIDE", "TIER", "UPSIDE%", "CAPACITY", "SIZE", "ACTION"])}\n`
  );
  for (const r of rows) process.stdout.write(`${fmt(r)}\n`);
}

function planHashOf(trades) {
  const canonical = JSON.stringify(
    trades.map((t) => ({
      signal_id: t.signal_id,
      condition_id: t.condition_id,
      token_id: t.token_id,
      side: t.side,
      size_usd: t.size_usd,
      expected_cost_cents: t.expected_cost_cents,
    }))
  );
  return createHash("sha256").update(canonical).digest("hex");
}

// ── Phase 2: --execute --confirm <hash> ───────────────────────────────────────

async function runConfirm(opts, bankrKey) {
  const planFile = readJsonFile(EXEC_PLAN_FILE);
  if (!planFile || !Array.isArray(planFile.trades) || !planFile.trades.length) {
    die(2, `no execution plan on file (${EXEC_PLAN_FILE}) — run --execute first`);
  }
  const fullHash = planHashOf(planFile.trades);
  if (fullHash !== planFile.plan_hash || !fullHash.startsWith(opts.confirmHash)) {
    die(2, "plan hash mismatch (plan changed, was tampered with, or wrong --confirm value) — re-run --execute for a fresh preview");
  }
  if (Date.parse(planFile.created_at) < Date.now() - PLAN_TTL_MS) {
    die(2, `execution plan expired (older than ${PLAN_TTL_MS / 60000} min) — re-run --execute for a fresh preview`);
  }
  if (planFile.wallet !== opts.wallet) {
    die(2, "--wallet differs from the previewed plan — re-run --execute");
  }

  // Fresh venue re-quote for every trade before anything is submitted: the
  // confirmation is bound to the previewed prices, not just the trade list.
  for (const t of planFile.trades) {
    const book = await bookRead(t.market_slug, t.side === "YES" ? "yes" : "no", t.condition_id);
    if (book.error) {
      process.stderr.write(`signal-strategy: confirm re-quote failed for ${t.market_slug} (${book.error}) — aborting, nothing submitted.\n`);
      process.exit(12);
    }
    if (String(book.token_id) !== String(t.token_id)) {
      process.stderr.write(`signal-strategy: outcome token changed for ${t.market_slug} — aborting, nothing submitted. Re-run --execute.\n`);
      process.exit(12);
    }
    const askCents = book.best_ask != null ? book.best_ask * 100 : null;
    if (askCents == null || Math.abs(askCents - t.expected_cost_cents) > MAX_COST_DRIFT_CENTS) {
      process.stderr.write(
        `signal-strategy: ${t.market_slug} ask moved ${t.expected_cost_cents}¢ → ${askCents == null ? "?" : askCents.toFixed(1)}¢ (> ${MAX_COST_DRIFT_CENTS}¢ tolerance) — aborting, nothing submitted. Re-run --execute for a fresh preview.\n`
      );
      process.exit(12);
    }
    const depth = book.ask_notional_within_2c;
    if (depth != null && depth < t.size_usd) {
      process.stderr.write(
        `signal-strategy: ${t.market_slug} near-touch depth ($${depth}) fell below the order size (${fmtUsd(t.size_usd)}) — aborting, nothing submitted.\n`
      );
      process.exit(12);
    }
    t.confirm_ask_cents = askCents;
  }

  process.stderr.write(`signal-strategy: ${RISK_DISCLOSURE}\n`);

  const nowMs = Date.now();
  const state = loadState(nowMs);
  const results = [];
  let stopCode = 0;
  for (const t of planFile.trades) {
    if (!opts.json) process.stdout.write(`EXECUTE> bankr prompt "${t.prompt}"\n`);
    const preSize = await positionSize(opts.wallet, t.condition_id, t.outcome);
    const sub = await bankrSubmit(bankrKey, t.prompt);
    if (sub.error) {
      results.push({ ...t, job_status: "submit_failed", verification: sub.error });
      process.stderr.write(`signal-strategy: ${sub.error} — stopping batch.\n`);
      stopCode = 3;
      break;
    }
    t.job_id = sub.jobId;
    // Durable at submit time — a poll timeout must never cause a re-emit of
    // an order that may still fill.
    state.push({
      signalId: t.signal_id,
      conditionId: t.condition_id,
      side: t.side,
      emittedAt: new Date().toISOString(),
    });
    saveState(state);
    const { status, body } = await pollJob(bankrKey, sub.jobId);
    if (status !== "completed") {
      results.push({ ...t, job_status: status, verification: `job ended ${status}` });
      process.stderr.write(`signal-strategy: job ${sub.jobId} ended ${status} — stopping batch.\n`);
      stopCode = 3;
      break;
    }
    const verdict = await verifyJob(bankrKey, body, t, preSize, opts.wallet);
    results.push({ ...t, job_status: verdict.outcome, verification: verdict.detail });
    if (!opts.json) process.stdout.write(`         job ${sub.jobId}: ${verdict.outcome} (${verdict.detail})\n`);
    if (verdict.outcome !== "executed-verified") {
      if (verdict.outcome === "submitted-unverified") {
        process.stderr.write(
          `signal-strategy: job ${sub.jobId} is SUBMITTED-UNVERIFIED — an order may be live. Check the wallet and Bankr job manually before re-running. Stopping batch.\n`
        );
        stopCode = 13;
      } else {
        process.stderr.write(`signal-strategy: job ${sub.jobId} ${verdict.outcome} (${verdict.detail}) — stopping batch.\n`);
        stopCode = 3;
      }
      break;
    }
  }

  fs.rmSync(EXEC_PLAN_FILE, { force: true }); // single-use plan: confirmed or dead

  const allVerified = results.length === planFile.trades.length && results.every((r) => r.job_status === "executed-verified");
  if (opts.json) {
    process.stdout.write(
      `${JSON.stringify(
        {
          as_of: new Date().toISOString(),
          phase: "confirmed-execution",
          plan_hash: planFile.plan_hash,
          trades: results,
          executed: allVerified,
          risk_disclosure: RISK_DISCLOSURE,
        },
        null,
        2
      )}\n`
    );
  }
  process.exit(stopCode);
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const opts = parseArgs(process.argv.slice(2));

  const bankrKey = process.env.BANKR_API_KEY;
  if (opts.confirmHash && !bankrKey) {
    die(2, "--confirm requires BANKR_API_KEY (Bankr Agent API key with read-write; `bankr login ... --agent-api --read-write`).");
  }
  const base = (process.env.QUOTIENT_BASE_URL || DEFAULT_BASE).replace(/\/+$/, "");
  validateBaseUrl(base);

  if (opts.confirmHash) {
    await runConfirm(opts, bankrKey);
    return; // runConfirm always exits
  }

  process.on("exit", reportSpend);

  // Payment gate before any paid read: worst case, the signals feed pages
  // MAX_SIGNAL_PAGES times. The free pre-flight first validates the pinned
  // tuple and discovers the live price the plan is quoted at.
  await preflightRoute(base, "/api/v1/signals");
  const paymentPlan = [
    { route: "/api/v1/signals", count: MAX_SIGNAL_PAGES, price: routePrice("/api/v1/signals") },
  ];
  const cmdline = `signal-strategy.mjs --wallet ${opts.wallet} --budget ${opts.budget}${opts.execute ? " --execute" : ""}`;
  gatePayments(cmdline, paymentPlan, opts);
  paidPlanTotal = planTotal(paymentPlan);

  const nowMs = Date.now();
  const asOf = new Date(nowMs).toISOString();
  const skipped = [];

  // (1) Candidates: server-side filters, then belt-and-braces client re-filter.
  const [fetched, held] = await Promise.all([
    fetchSignals(base, opts),
    fetchHeldSet(opts.wallet),
  ]);

  const candidates = [];
  for (const s of fetched) {
    if (!s || typeof s.id !== "string") continue;
    if (s.side !== "YES" && s.side !== "NO") {
      skipped.push({ id: s.id, reason: "bad_side" });
    } else if (!opts.statuses.includes(s.status)) {
      skipped.push({ id: s.id, reason: `status:${s.status}` });
    } else if ((s.conviction_tier ?? 0) < opts.minConviction) {
      skipped.push({ id: s.id, reason: "conviction_below_min" });
    } else if (s.converge_upside_pct == null || s.converge_upside_pct <= 0) {
      skipped.push({ id: s.id, reason: "no_priced_upside" });
    } else if (s.capacity_usd_at_2c != null && s.capacity_usd_at_2c < opts.minCapacity) {
      skipped.push({ id: s.id, reason: "capacity_below_min" });
    } else if (s.capacity_usd_at_2c == null && s.capacity_basis !== "volume-fallback") {
      skipped.push({ id: s.id, reason: "no_capacity_basis" });
    } else if (typeof s.market?.slug !== "string" || !SLUG_RE.test(s.market.slug)) {
      skipped.push({ id: s.id, reason: "bad_slug" });
    } else if (opts.execute) {
      // Execution demands strictly more than browsing: reject anything stale,
      // graph-priced, volume-fallback, or missing a verifiable condition id.
      const fresh =
        s.is_fresh === true ||
        (s.forecast_updated_at && nowMs - Date.parse(s.forecast_updated_at) <= FRESH_MAX_AGE_MS);
      if (s.status !== "actionable") {
        skipped.push({ id: s.id, reason: "exec:not_actionable" });
      } else if (!fresh) {
        skipped.push({ id: s.id, reason: "exec:stale_forecast" });
      } else if (s.live_priced !== true) {
        skipped.push({ id: s.id, reason: "exec:not_live_priced" });
      } else if (s.capacity_basis === "volume-fallback" || s.capacity_usd_at_2c == null) {
        skipped.push({ id: s.id, reason: "exec:no_depth_snapshot" });
      } else if (!CONDITION_RE.test(String(s.market?.condition_id || ""))) {
        skipped.push({ id: s.id, reason: "exec:bad_condition_id" });
      } else {
        candidates.push(s);
      }
    } else {
      candidates.push(s);
    }
  }

  // (2) Idempotency: current holdings + prompts emitted in the last 48h.
  const state = loadState(nowMs);
  const emittedIds = new Set(state.map((e) => e.signalId));
  const emittedKeys = new Set(
    state.filter((e) => e.conditionId).map((e) => `${e.conditionId}:${String(e.side).toLowerCase()}`)
  );
  const fresh = [];
  for (const s of candidates) {
    const key = s.market?.condition_id
      ? `${s.market.condition_id}:${s.side === "YES" ? "yes" : "no"}`
      : null;
    if (key && held.has(key)) {
      skipped.push({ id: s.id, reason: "already_held" });
    } else if (emittedIds.has(s.id) || (key && emittedKeys.has(key))) {
      skipped.push({ id: s.id, reason: "recently_emitted" });
    } else {
      fresh.push(s);
    }
  }

  // (3) Rank: conviction tier desc → converge upside desc → published_at desc.
  fresh.sort(
    (a, b) =>
      (b.conviction_tier ?? 0) - (a.conviction_tier ?? 0) ||
      (b.converge_upside_pct ?? 0) - (a.converge_upside_pct ?? 0) ||
      ((a.published_at ?? a.created_at) < (b.published_at ?? b.created_at)
        ? 1
        : (a.published_at ?? a.created_at) > (b.published_at ?? b.created_at)
          ? -1
          : 0)
  );
  const ranked = fresh.slice(0, Math.min(fresh.length, opts.maxPositions));
  for (const s of fresh.slice(ranked.length)) {
    skipped.push({ id: s.id, reason: "beyond_max_positions" });
  }

  // (4) Sizing: equal weight, capped at 10% of near-touch capacity. No
  // redistribution — deterministic underspend beats over-concentration.
  // (--execute plans always have capacity_usd_at_2c; the uncapped fallback
  // survives only in dry-run browsing of volume-fallback rows.)
  const n = ranked.length;
  const per = n > 0 ? Math.floor((opts.budget / n) * 100) / 100 : 0;
  const plan = [];
  const tableRows = [];
  for (const s of ranked) {
    const size =
      s.capacity_usd_at_2c != null ? Math.min(per, Math.floor(0.1 * s.capacity_usd_at_2c)) : per;
    const capCell =
      s.capacity_usd_at_2c != null ? `$${Math.round(s.capacity_usd_at_2c)}` : "vol-fb";
    const row = [
      trunc(s.id, 22),
      trunc(s.market?.slug ?? "?", 36),
      s.side,
      String(s.conviction_tier ?? "-"),
      `+${s.converge_upside_pct}%`,
      capCell,
    ];
    if (size < 1) {
      skipped.push({ id: s.id, reason: "size_below_min" });
      tableRows.push([...row, "-", "skip:size_below_min"]);
      continue;
    }
    const amount = size.toFixed(2).replace(/\.00$/, "");
    const prompt = `Bet $${amount} on ${s.side === "YES" ? "Yes" : "No"} for ${s.market.slug} on Polymarket`;
    plan.push({
      signal_id: s.id,
      market: s.market.slug,
      condition_id: s.market.condition_id ?? null,
      side: s.side,
      conviction_tier: s.conviction_tier ?? null,
      converge_upside_pct: s.converge_upside_pct,
      capacity_usd_at_2c: s.capacity_usd_at_2c,
      capacity_basis: s.capacity_basis ?? null,
      capacity_as_of: s.capacity_as_of ?? null,
      proposed_size_pct_of_capacity:
        s.capacity_usd_at_2c > 0
          ? Math.round((size / s.capacity_usd_at_2c) * 10000) / 100
          : null,
      estimated_impact_band:
        s.capacity_usd_at_2c == null
          ? "unknown-no-depth-snapshot"
          : size <= s.capacity_usd_at_2c
            ? "inside-2c-snapshot-not-guaranteed"
            : "exceeds-2c-snapshot",
      current_cost_cents: s.current_cost_cents ?? null,
      live_priced: s.live_priced ?? false,
      priced_at: s.priced_at ?? null,
      price_impact_notice: LIQUIDITY_NOTICE,
      size_usd: size,
      question: s.market.question ?? null,
      prompt,
    });
    tableRows.push([...row, fmtUsd(size), opts.execute ? "plan" : "buy"]);
  }
  const budgetUsed = plan.reduce((sum, p) => sum + p.size_usd, 0);

  // Human plan output first, so the table precedes any execution lines.
  if (!opts.json) {
    process.stdout.write(
      `Quotient signal strategy — ${asOf}\nwallet ${opts.wallet} · budget ${fmtUsd(opts.budget)} · window ${opts.windowHours}h · status ${opts.statuses.join(",")} · min tier ${opts.minConviction} · min capacity ${fmtUsd(opts.minCapacity)}\n\n`
    );
    if (tableRows.length) {
      printTable(tableRows);
    } else {
      process.stdout.write("No eligible signals after filters.\n");
    }
    if (skipped.length) {
      const summary = skipped.map((sk) => `${trunc(sk.id, 22)} (${sk.reason})`).join(", ");
      process.stdout.write(`\nSkipped ${skipped.length}: ${summary}\n`);
    }
    process.stdout.write(`\nBudget used: ${fmtUsd(budgetUsed)} of ${fmtUsd(opts.budget)}\n`);
    if (plan.length) process.stdout.write(`Liquidity / price impact: ${LIQUIDITY_NOTICE}\n`);
  }

  // (5) Phase 1 of execution: enrich with outcome-verified live books, write
  // the plan file, preview, exit 12. NOTHING is submitted here.
  if (opts.execute) {
    const trades = [];
    for (const p of plan) {
      const book = await bookRead(p.market, p.side === "YES" ? "yes" : "no", p.condition_id);
      if (book.error) {
        skipped.push({ id: p.signal_id, reason: `exec:${book.error}` });
        continue;
      }
      const askCents = book.best_ask != null ? Math.round(book.best_ask * 1000) / 10 : null;
      if (askCents == null) {
        skipped.push({ id: p.signal_id, reason: "exec:no_live_ask" });
        continue;
      }
      trades.push({
        signal_id: p.signal_id,
        market_slug: p.market,
        question: p.question,
        condition_id: p.condition_id,
        outcome: book.outcome,
        token_id: String(book.token_id),
        side: p.side,
        size_usd: p.size_usd,
        expected_cost_cents: askCents,
        live_book: {
          best_bid: book.best_bid ?? null,
          best_ask: book.best_ask ?? null,
          spread: book.spread ?? null,
          ask_notional_within_2c: book.ask_notional_within_2c ?? null,
        },
        pct_of_live_depth:
          book.ask_notional_within_2c > 0
            ? Math.round((p.size_usd / book.ask_notional_within_2c) * 10000) / 100
            : null,
        prompt: p.prompt,
      });
    }
    if (!trades.length) {
      if (!opts.json) process.stdout.write("\nNo executable trades after live-book verification.\n");
      if (opts.json) {
        process.stdout.write(
          `${JSON.stringify({ as_of: asOf, phase: "plan-preview", plan: [], skipped, budget_used: 0, risk_disclosure: RISK_DISCLOSURE, executed: false }, null, 2)}\n`
        );
      }
      process.exit(0);
    }
    const hash = planHashOf(trades);
    atomicWriteJson(EXEC_PLAN_FILE, {
      version: 1,
      created_at: asOf,
      wallet: opts.wallet,
      budget: opts.budget,
      trades,
      plan_hash: hash,
    });
    const short = hash.slice(0, 12);
    if (opts.json) {
      process.stdout.write(
        `${JSON.stringify(
          {
            as_of: asOf,
            phase: "plan-preview",
            plan_hash: hash,
            trades,
            skipped,
            budget_used: trades.reduce((s, t) => s + t.size_usd, 0),
            liquidity_notice: LIQUIDITY_NOTICE,
            risk_disclosure: RISK_DISCLOSURE,
            confirm_with: `--execute --confirm ${short} (within ${PLAN_TTL_MS / 60000} min)`,
            executed: false,
          },
          null,
          2
        )}\n`
      );
    } else {
      process.stdout.write("\nEXECUTION PLAN (nothing submitted yet):\n");
      for (const t of trades) {
        process.stdout.write(
          `  ${t.market_slug} — ${t.question ?? "?"}\n` +
            `    condition ${t.condition_id}\n` +
            `    buy ${t.side} (outcome "${t.outcome}", token ${t.token_id})\n` +
            `    amount ${fmtUsd(t.size_usd)} · live ask ${t.expected_cost_cents}¢ · spread ${t.live_book.spread ?? "?"} · 2¢ ask depth $${t.live_book.ask_notional_within_2c ?? "?"} (${t.pct_of_live_depth ?? "?"}% of depth)\n` +
            `    venue Polymarket CLOB (settles on Polygon) via Bankr prompt: "${t.prompt}"\n` +
            `    fees/slippage: a market order can walk the book beyond the quoted ask; venue fees where applicable\n`
        );
      }
      process.stdout.write(`\n${RISK_DISCLOSURE}\n`);
      process.stdout.write(
        `\nPlan ${short} written (valid ${PLAN_TTL_MS / 60000} min). After the user approves THIS exact plan, submit with:\n  signal-strategy.mjs --wallet ${opts.wallet} --budget ${opts.budget} --execute --confirm ${short}\n`
      );
    }
    process.exit(12);
  }

  // (6) Dry run output.
  if (opts.json) {
    process.stdout.write(
      `${JSON.stringify({ as_of: asOf, phase: "dry-run", plan, skipped, budget_used: budgetUsed, liquidity_notice: LIQUIDITY_NOTICE, risk_disclosure: RISK_DISCLOSURE, executed: false }, null, 2)}\n`
    );
  } else {
    for (const p of plan) process.stdout.write(`DRY-RUN> bankr prompt "${p.prompt}"\n`);
    if (plan.length) {
      process.stdout.write(
        "Dry run: nothing submitted, no state written. Use --execute to preview an execution plan (exit 12), then --execute --confirm <hash> to submit.\n"
      );
    }
  }
  process.exit(0);
}

main().catch((err) => {
  die(1, `unexpected error: ${err?.stack || err}`);
});
