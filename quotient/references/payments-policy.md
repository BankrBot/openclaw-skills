<!-- GENERATED from public/skill/references/payments-policy.md — edit there, then npm run skill:build -->

# Payments Policy, Ledger, and Approval Protocol

Canonical spec for the skill's paid-call machinery. Two implementations follow this file
and must not drift: `scripts/payments.sh` (sourced by `quotient.sh` and
`converge-monitor.sh`) and the inline mirror in `scripts/signal-strategy.mjs`.

## Payment Modes

- **`report`** — paid calls run non-interactively within the pinned per-route caps and
  host allowlist; every payment is ledgered and a spend summary is printed after the run.
  The agent surfaces that cost to the user in its answer.
- **`confirm`** — nothing is paid unless a local autopay policy covers the run or the
  exact previewed plan was approved with `--approve <token>`. Without either, scripts
  print a payment preview and exit `10`.

The mode default is set per distribution at build time (the Bankr distribution ships
`confirm`). `QUOTIENT_PAYMENT_MODE=confirm` may tighten `report` → `confirm`; nothing in
env can loosen `confirm` — only the user-created autopay policy grants standing approval.

## Route Prices: Live Under a Pinned Ceiling

The pattern throughout the skill: **live-read anything informational; pin anything that
bounds spending or identifies a counterparty.** Price is both, so it is live-read under a
pinned bound:

1. Before paying a route, the scripts **pre-flight its 402 challenge** — a free,
   unauthenticated GET — and validate the complete pinned payment tuple: scheme `exact`,
   network `eip155:8453` (or `eip155:4663`), the canonical asset contract, the pinned
   Quotient payee (`0xC3d01FD2F79d4c57aD106AB8ecc12a5dE24F97cB`), and
   `maxTimeoutSeconds ≤ 300`. **Any mismatch is a hard failure** — server-supplied terms
   that disagree with the pinned tuple are the attack signal, and nothing is paid. This
   also gives the `bankr x402 call` path tuple validation it otherwise could not have.
2. The challenge's live price becomes the call's `--max-payment`, **clamped by a pinned
   ceiling of 2× the published price** below. Price drops flow through automatically and
   modest raises never brick the skill; a raise above the ceiling fails closed until the
   user accepts it via a `route_overrides` entry (which replaces the ceiling).
3. When the pre-flight is unavailable (network hiccup, missing header), the published
   price is the fallback cap.
4. Two-read caveat: the payer fetches the challenge again itself, so a server could show
   different terms to each read — the cap and the host allowlist still bound that
   residual risk.

`QUOTIENT_MAX_PAYMENT_USD` may only lower the effective cap, never raise it.

Published prices (ceiling = 2× these):

| Route | USD |
|---|---|
| `/api/v1/markets` | 0.005 |
| `/api/v1/markets/mispriced` | 0.05 |
| `/api/v1/markets/lookup` | 0.005 |
| `/api/v1/markets/{slug}/forecast` | 0.01 |
| `/api/v1/markets/{slug}/intelligence` | 0.025 |
| `/api/v1/markets/{slug}/signals` | 0.025 |
| `/api/v1/sources` | 0.01 |
| `/api/v1/signals` | 0.02 |
| `/api/v1/signals/featured` | 0.01 |
| `/api/v1/signals/oil` | 0.025 |
| `/api/v1/portfolio` | 0.0025 |
| `/api/v1/narratives` | 0.01 |
| `/api/v1/signal-score` | 0.005 |

Routes not in this table are refused (exit 2) rather than paid at a guessed cap.

## Host Allowlist

`QUOTIENT_BASE_URL` must be a bare origin and either the default
`https://quotient-api-gateway.onrender.com` or an exact member of the policy file's
`extra_hosts[]`. Extra origins must be HTTPS (plain `http://` is tolerated only for
`localhost`/`127.0.0.1` testing). **Env and fetched content can never add hosts** — only
the user-created policy file can. Violation exits 2 before anything is paid.

## Files

All state lives per-user, atomically written (tmp + rename):

| File | Purpose |
|---|---|
| `${XDG_CONFIG_HOME:-~/.config}/quotient-skill/autopay.json` | user-authorized autopay policy |
| `${XDG_STATE_HOME:-~/.local/state}/quotient-skill/spend-ledger.json` | append-only spend ledger (30-day entries + monotonic lifetime total) |
| `${XDG_STATE_HOME:-~/.local/state}/quotient-skill/pending-approval.json` | the one outstanding payment preview token |
| `${XDG_STATE_HOME:-~/.local/state}/quotient-skill/exec-plan.json` | the one outstanding trade plan (`signal-strategy.mjs --execute`) |

### autopay.json

Created only by `quotient.sh autopay init` — and only in direct response to an explicit
user instruction stating the amounts (e.g. accepting the "pre-authorize $1.00" offer).

```json
{
  "version": 1,
  "created_at": "2026-08-04T17:20:00Z",
  "authorized_note": "user approved $1.00 pre-authorization in chat",
  "autopay": {
    "enabled": true,
    "per_call_max_usd": 0.05,
    "per_run_max_usd": 0.25,
    "per_day_max_usd": 1.00,
    "total_budget_usd": 1.00,
    "expires_at": null
  },
  "route_overrides": {},
  "extra_hosts": [],
  "lifetime_spent_at_init_usd": 0
}
```

Cap semantics: `per_call` bounds any single route price; `per_run` bounds one script run's
worst-case total; `per_day` bounds today's ledgered spend plus the run; `total_budget_usd`
bounds ledger lifetime spend since `lifetime_spent_at_init_usd` (snapshotted at init);
`expires_at` (ISO) hard-stops the policy. Any violated cap → preview + exit `11`.
A `route_overrides` entry (`{"<route>": {"max_payment_usd": N}}`) replaces that route's
price ceiling — the deliberate, user-authorized way to accept a raised gateway price.
`quotient.sh autopay status` reports spend against budget; `autopay revoke` deletes the
policy.

### spend-ledger.json

```json
{
  "version": 1,
  "lifetime_spent_usd": 0.0825,
  "entries": [
    {
      "ts": "2026-08-04T17:21:03Z",
      "run_id": "r-20260804172100-7213",
      "route": "/api/v1/signals",
      "url": "https://quotient-api-gateway.onrender.com/api/v1/signals?window=24",
      "max_payment_usd": 0.02,
      "charged_usd_estimate": 0.02,
      "approval": "user-token | autopay | report-mode",
      "attempt": 1,
      "status": "paid | failed"
    }
  ]
}
```

`charged_usd_estimate` is honest wording: `bankr x402 call --raw` hides the settlement
header, so the ledger records the enforced cap (= the route's exact price), not a settled
receipt. Entries older than 30 days are pruned; `lifetime_spent_usd` is monotonic and
survives pruning. The ledger is the user's audit trail — never delete or rewrite it.

### pending-approval.json

```json
{
  "token": "qpay-20260804172011-7f3a1b9c",
  "created_at": "2026-08-04T17:20:11Z",
  "command": "quotient.sh signals --window 24",
  "calls": [ { "route": "/api/v1/signals", "count_max": 1, "max_payment_usd": 0.02, "subtotal_usd": 0.02 } ],
  "total_max_usd": 0.02
}
```

`--approve <token>` succeeds only when the token matches, is younger than **15 minutes**,
and the re-computed call plan of the current invocation equals the stored one (routes,
counts, caps). Anything else exits 2 with "re-preview". A consumed token is deleted.
Approval tokens bind consent to an exact plan — they are not a security boundary against
an agent that fabricates approval, which is why the SKILL.md guardrails forbid exactly
that and the ledger records which approval kind each payment used.

## The payment_preview Object (stdout on exit 10/11)

```json
{
  "type": "payment_preview",
  "reason": "approval_required | cap_exceeded",
  "mode": "confirm | report",
  "command": "quotient.sh signals --window 24",
  "calls": [ { "route": "/api/v1/signals", "count_max": 1, "max_payment_usd": 0.02, "subtotal_usd": 0.02 } ],
  "total_max_usd": 0.02,
  "today_spent_usd": 0.0325,
  "caps": null,
  "cap_violations": [],
  "approval_token": "qpay-20260804172011-7f3a1b9c",
  "approve_with": "re-run the same command with --approve qpay-20260804172011-7f3a1b9c",
  "preauth_offer": {
    "amount_usd": 1.0,
    "covers_requests_like_this": 50,
    "create_with": "./scripts/quotient.sh autopay init --total-budget 1.00"
  },
  "warnings": []
}
```

`preauth_offer` appears only while no policy exists — it is the material for the
first-time "pre-authorize $1.00 ≈ N requests like this one" offer.

## Retry & Idempotency Rules

- One run pays a given URL at most once (in-memory memoization).
- A failed paid call is retried once after 2 s; both attempts are ledgered; retries never
  push the run past its approved worst-case total.
- A URL paid within the last 10 minutes triggers a warning before being paid again.
- Exit codes 10/11/12/13 are never auto-retried — they wait for a human.

## exec-plan.json (signal-strategy two-phase execution)

```json
{
  "version": 1,
  "created_at": "2026-08-04T17:30:00Z",
  "wallet": "0x…",
  "budget": 100,
  "plan_hash": "sha256-hex of the canonical trades array",
  "trades": [
    {
      "signal_id": "qs_…", "market_slug": "…", "question": "…",
      "condition_id": "0x…64hex", "outcome": "No", "token_id": "…",
      "side": "NO", "size_usd": 20, "expected_cost_cents": 64.0,
      "live_book": { "best_bid": 0.62, "best_ask": 0.64, "spread": 0.02, "ask_notional_within_2c": 5400 },
      "pct_of_live_depth": 0.37,
      "prompt": "Bet $20 on No for … on Polymarket"
    }
  ]
}
```

`--execute --confirm <hash>` requires: hash prefix match + full-hash recompute (tamper
check), plan age under **10 minutes**, same `--wallet`, and a fresh outcome-aware book
re-quote per trade within **2¢** of `expected_cost_cents` with depth still covering the
order. The plan file is single-use — deleted after any confirm attempt.
