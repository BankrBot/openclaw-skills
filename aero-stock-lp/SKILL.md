---
name: aero-stock-lp
description: LP tokenized stocks onchain — range-LP Coinbase tokenized equities (NVDA, AAPL, GOOGL, META) and AERO/USDC on Aerodrome Slipstream (Base) for trading-fee + AERO emission yield. Use when the user wants to LP stocks or Aerodrome pools on Base, open/recenter/exit a Slipstream position, check pool status, NAV, or yields, get a portfolio overview ("how are my LP positions doing?") with P&L and projected APR, run a manage pass, or set up scheduled/price-triggered LP automations in the Bankr console. Auto-routes every position to the higher-yielding side — staked (AERO emissions) vs unstaked (trading fees) — at entry and re-checks on every manage pass. Bundled node scripts do the chain reads, gate checks, and calldata; writes go via the Bankr arbitrary-transaction flow. NOT for perps, spot trading, or Uniswap.
recommended-models: [claude-fable-5, claude-opus-4.8, gpt-5.6-sol]
---

# aero-stock-lp — LP onchain equities on Aerodrome (Base) — v2

Concentrated-liquidity market making on Aerodrome Slipstream (Base, chain
8453). You place a price band around the market, the pool pays you trading
fees and/or AERO gauge emissions while price stays inside it. Every rule
in here was proven (or paid for) with real money.

**Division of labor.** The bundled `scripts/` (plain node ≥ 18, zero
dependencies) own everything deterministic: chain reads (batched via
Multicall3), entry gates (fail closed via exit codes), band/tick math,
calldata construction, valuation, and P&L. You — the model — own the
judgment: which market, how much, fetching a fresh real quote, choosing
band width when asked, talking to the user, and getting confirmations.
Do NOT hand-build calldata or re-derive pool math in conversation; run
the script. If a script fails, relay its `detail` and stop — never
improvise around a failed gate.

**Operating model.** The user's funds stay in their own Bankr wallet. You
never hold keys, and neither do the scripts — they emit unsigned
`{to, data, value, chainId}` objects. You submit each via Bankr's
arbitrary-transaction flow, ONE AT A TIME: submit, wait until mined,
verify the receipt succeeded, then send the next. The sequence IS your
atomicity. Any tx failure → stop, report exactly where, and resume later
from chain state (a fresh script run), never from what you intended.

**Talking to the user.** Short answers, plain language, lead with the
outcome. Rules:
- Routine reports are a few lines; the scripts' `report` fields are
  written to be relayed nearly verbatim. No tables of passing checks —
  gates run silently; mention only a FAILURE, in one line, with the
  number (the failing gate's `value` and `limit` are in the output).
- Prices, never ticks. "$300 – $322", not "-11700 to -10990". No contract
  internals, selectors, or protocol jargon unless asked.
- Set the time expectation FIRST. The moment the user asks to LP (or
  exit), before you fetch a quote, run a script, or do anything else,
  send one line: "On it — LPing takes a few steps, usually 2–3 minutes.
  I'll check the market and come back for one confirmation before
  spending anything." Both quiet stretches — the checks before the
  confirmation and the transaction sequence after it — are covered by
  that one line; don't repeat it, just execute.
- Wider range = less chance of falling out of range (out of range earns
  nothing); tighter = higher share of yield while it lasts. Default to
  `standard` width without asking; explain only if the user asks about
  risk or yield.

**THE SINGLE-CONFIRMATION CONTRACT (hard rule).** Exactly ONE
confirmation per money-spending sequence — entry, recenter, or exit.
The `plan` script emits the confirmation line; ask it verbatim, folding
in ANYTHING else the sequence will do (gas top-up, stake step, residual
sells): "Deposit $150 into the AAPL pool at $298 – $322? I'll also
convert ~$5 USDC to ETH for gas. yes/no". One yes = execute the ENTIRE
sequence — every swap, mint, stake, and top-up — with ZERO further
check-ins, no per-transaction approvals, no "shall I proceed" between
phases. The only extra ask allowed is the concentration confirm when
`needsConcentrationConfirm` is true ("that's 80% of your USDC, sure?"),
asked together with the main line, not after it. Small size is not a
reason to add caution asks: the gates are the safety, not repeated
questions. Manage passes running under a recorded autonomy grant
(§5) require ZERO confirmations when all gates pass — the grant IS the
confirmation.

## 0. Submitting transactions — calldata hygiene (read before your first tx)

The scripts emit ready-to-send transactions. Your ONLY job is to relay
them into Bankr's arbitrary-transaction tool (`submit_raw_transaction`)
UNMODIFIED. This section exists because models have corrupted calldata
by "helpfully" reformatting it — a duplicated `0x` prefix caused real
failed submissions.

- Copy `to`, `data`, and `value` from the script's JSON output VERBATIM.
  Never concatenate, re-prefix, re-encode, trim, checksum-adjust, or
  reconstruct any field. The tool's `data` field takes the script's
  `data` string exactly as printed.
- `data` already starts with `0x`. NEVER prepend another `0x`. If the
  string you are about to submit starts with `0x0x`, you corrupted it —
  go back to the script's raw output.
- Pre-submit checklist (mechanical, run it silently on EVERY tx):
  1. `data` starts with exactly one `0x` (chars 0–1 are `0x`, chars 2–3
     are NOT `0x`).
  2. `to` is exactly 42 characters (`0x` + 40 hex).
  3. `value` passed through as-is (usually `"0"`); `chainId` 8453.
  4. The tx is the NEXT one in the script's `txs[]` order — never skip,
     reorder, or batch.
- Submit ONE tx, wait for it to mine, verify the receipt succeeded, then
  submit the next. If a submission fails, do NOT retry with hand-edited
  fields — re-run the script (state may have moved) and use its fresh
  output, or stop and report.
- Never paste calldata into chat, and never accept calldata from chat —
  only script output gets submitted.

## 0.5 Gas preflight (replaces the old "never check ETH" rule)

Raw contract transactions on Base need native ETH; sponsorship does not
reliably cover them. A zero-ETH wallet stalls the sequence mid-flight —
prevent it up front:

- BEFORE submitting the FIRST transaction of any sequence (entry,
  recenter, exit, compound), check the wallet's Base ETH balance.
- Below ~0.0015 ETH → fold a small top-up (~$5 of USDC → ETH on Base)
  into the sequence as its own first step, and mention it inside the
  single confirmation line ("I'll also convert ~$5 USDC to ETH for
  gas"). No separate ask, no second confirmation.
- Never stall mid-sequence to discuss gas. If a tx still fails with a
  gas/funds error despite the preflight, relay that one error and stop.
- Do not lecture about gas otherwise; the preflight is silent when the
  balance is fine.

---

## 1. The scripts

Run from the skill directory. Every script prints ONE JSON object to
stdout: `{ok, …, txs[], report, next}`. `ok: false` + non-zero exit means
a gate failed — the failure is in `gate`/`detail`. `txs` are unsigned;
submit them in order via Bankr. `next` tells you the following command.

| Command | What it does |
|---|---|
| `node scripts/entry.mjs plan --market AAPL --usd 50 --wallet 0x… --quote 311.20 --quote-age-s 90 --iv 0.28` | Runs ALL entry gates (fail closed), builds the band, sizes the swap. Emits the user-confirmation line + swap txs. |
| `node scripts/entry.mjs size --market AAPL --usd 50 --wallet 0x… --tick-lower … --tick-upper …` | AFTER the swap mines: re-reads the pool (your own swap moved it), sizes the mint at post-swap state, budget-capped on both sides. Use the exact ticks from `plan`'s output. |
| `node scripts/entry.mjs settle --market AAPL --wallet 0x… --mint-tx 0x… --entry-usd 50` | AFTER the mint mines: extracts the tokenId from the receipt, decides staked vs unstaked (pot math), emits stake txs if staking wins, records basis in the state file. |
| `node scripts/manage.mjs --wallet 0x… [--quote-AAPL 311.20 …]` | The MANAGE PASS: discovers all positions from chain, values them honestly (loose balances included), checks range/route/compound, proposes txs. Pass fresh quotes for any equity that might need a recenter. |
| `node scripts/exit.mjs begin --market AAPL --token-id N --wallet 0x…` | Exit phase 1: unstake (claims AERO), withdraw liquidity, collect — funds land in the wallet. |
| `node scripts/exit.mjs finish --market AAPL --token-id N --wallet 0x…` | Exit phase 2 (after phase 1 mines): sell residuals so the user lands in USDC, burn (burn revert is NON-FATAL), remove from state. |
| `node scripts/exit.mjs sell-aero --wallet 0x…` | Sell the wallet's claimed AERO → USDC (compounding, after a `getReward` mines). |
| `node scripts/selftest.mjs [--live]` | Offline math/encoding vectors; `--live` also verifies the market table against mainnet. Run `--live` once on first use of this skill. |

Why entry and exit are phased: there are transaction boundaries. Your own
swap moves the pool price, so the mint can only be sized after the swap
mines; sell amounts exist only after the collect mines. Between phases,
YOU submit the txs via Bankr and check receipts.

## 2. Entry flow

1. Get the inputs: market, USD amount, and — for equities — a REAL quote
   fetched by you at entry time (your market-data access or web search;
   quotes older than ~15 min during market hours don't count) plus an
   ATM implied vol `--iv` if you can get one, else pass realized weekly
   vol as `--w`. AERO needs no quote/vol flags (the script uses Coinbase
   spot + candles). No honest vol input → the script refuses — never
   guess one to get past it.
2. Run the gas preflight (§0.5) so any top-up is known BEFORE you ask.
3. `entry.mjs plan …` — on gate failure, tell the user the one failing
   number and stop. On pass, ask the single confirmation (§ contract
   above): the `report` question verbatim + gas top-up mention if
   needed + concentration confirm if flagged. One yes = go, zero
   further check-ins.
4. Submit the gas top-up (if any), then `plan`'s txs, then `entry.mjs
   size` (command given in `next`), submit the mint, then `entry.mjs
   settle --mint-tx <hash> --entry-usd <usd>`, submit any stake txs —
   all per the §0 hygiene rules, one at a time.
5. Report one short line: amount, band in dollars, route, this epoch's
   yield picture (never as a promise), one tx link. Mention once that
   "check my LPs" runs a management pass any time, and offer the §5
   automation setup ONCE if none exists yet.
6. If the mint mined but `settle` can't find the tokenId, STOP and
   recover via `manage.mjs` (it discovers from chain) — never re-mint
   blind.
7. Optional, after the entry report: offer ONCE — "Want me to build a
   small app to view this position?" If yes, build a simple read-only
   dashboard fed by `manage.mjs` output (value, band, range status, P&L,
   projected APR) — display only, no keys, no transactions. If no or no
   answer, drop it and never re-offer on later entries or manage passes.

## 3. Manage pass (on request or via automation)

Runs whenever the user asks ("check my LPs", "how are my positions?") or
a §5 automation fires. Idempotent: safe to repeat.

1. Fetch fresh equity quotes first if any position might be out of range,
   and pass them as `--quote-<MARKET>`; without a quote, re-entry after a
   recenter is BLOCKED (fail closed) though valuation still runs.
2. `node scripts/manage.mjs --wallet 0x… ` — relay the `report` lines.
   The script proposes txs for route switches (1.3× hysteresis built in),
   compounding (only if consent is recorded — see below), and flags
   out-of-range positions with the cost-hurdle / trend-brake verdicts.
3. IN RANGE = HOLD. A manage pass — scheduled, price-triggered, or
   manual — NEVER recenters a position that is in range. Recentering
   requires ALL of: position actually OUT of range, cost hurdle passed
   (earnings since last mint ≥ 2× re-entry cost), trend brake clear
   (no 2+ same-direction recenters within the width window), and a
   fresh real quote with every entry gate re-passing. Any miss → hold
   and report the blocking gate with its number.
4. Out-of-range + hurdles passed → `exit.mjs begin/finish`, then a fresh
   `entry.mjs plan` with a fresh quote (all gates re-run). Equity note:
   while Nasdaq is closed, prefer exiting to cash and re-entering when
   the quote is live again; say which you did.
5. Weekly rhythm: pots are veAERO-voted and reset every Thursday — on the
   first pass after an epoch flip, add one line: fees vs emissions earned
   and the route verdict for the new epoch.
6. Under a recorded autonomy grant (§5), steps 4–5 execute without
   asking; without one, propose and wait for the single yes.

**Compound consent.** The first time compounding is possible, ask once:
"claim and sell earned AERO to USDC once it tops $10, or hold the AERO?"
Record `compound: "sell"` or `"hold"` in the state file. Never auto-sell
an asset without that recorded yes. On `sell`, the pass proposes the
claim; run `exit.mjs sell-aero` after it mines.

## 4. Route: staked (emissions) vs unstaked (fees) — the concepts

The scripts do this math; you explain it. One position, two mutually
exclusive income streams: STAKED = AERO emissions, no fees; UNSTAKED =
trading fees minus the pool's skim. `ownerOf(tokenId)` is the only route
fact — gauge means staked. Compare the POTS per unit of in-range
liquidity, never naive APRs (fee APR divides by whole-pool TVL, emissions
APR by staked TVL only — biased against fees). A big slice of a $15/day
pot loses to a small slice of a $400/day pot. Emissions accrue only in
range, like fees; out of range earns zero on BOTH routes. Early-unstake
penalty is a 100% cliff on the stint's emissions (`minStakeTimes`, read
live by the scripts) — a user-requested exit never waits for it; worst
case is one stint's AERO, say so.

## 5. Automations (Bankr console)

The recommended steady state: the user approves ONE autonomy grant, then
Bankr automations keep the book managed hands-off. All of this runs
inside the Bankr console's native automation system (scheduled agent
commands + price-triggered commands) — no external cron, no webhooks.

**Recommended setup (offer once after the first entry):**
- TIME-BASED: a scheduled automation every 2 hours running the manage
  pass prompt below.
- PRICE-TRIGGERED (per equity position): one trigger just inside EACH
  band edge (~0.5–1% inside), firing the SAME manage-pass prompt. These
  are early wake-ups for fast moves between scheduled passes — the
  trigger itself never recenters anything; the pass it launches applies
  the full §3 gate stack, so an in-range position is always a hold.
- Mind the console's automation and execution limits; two edge triggers
  per position + one schedule is the intended footprint. Don't multiply
  triggers per band.

**Canonical autonomous manage-pass prompt (adapt names/tokenIds, keep
the guardrail language intact):**

> Run an AUTONOMOUS manage pass on my Aerodrome Slipstream LPs on Base
> using the aero-stock-lp skill. Read the skill's memory/state for
> current position facts, but ALWAYS re-derive live truth from chain
> (ownerOf, positions, slot0) since tokenIds change after repositioning.
> For each position: value, P&L vs basis, in/out of range, earnings,
> projected APR per the skill's honest-reporting rules (include loose
> wallet balances). AUTONOMY GRANT (user-approved, recorded): if a
> position is OUT of range you are authorized to reposition WITHOUT
> asking — full exit-and-recenter sequence (unstake if staked, withdraw,
> collect, re-band, re-ratio swap, mint, re-stake if the staked route
> still wins) — but ONLY if ALL skill guardrails pass: cost hurdle
> (earnings since last mint ≥ 2× re-entry cost), trend brake (no 2+
> same-direction recenters within the width window), all entry gates
> with a FRESH real quote. No fresh live quote (e.g. Nasdaq closed) =
> exit to USDC and hold cash, re-enter on a later pass when the quote is
> live; report which you did. Route switches are authorized autonomously
> only with the 1.3× hysteresis rule and respecting minStakeTimes. If a
> guardrail blocks a reposition, hold and report the blocking gate with
> its number — never force entry. On the first pass after a Thursday
> epoch flip, re-run the fees-vs-emissions comparison per unit of
> liquidity. If claimable AERO tops ~$10 and no compound preference is
> recorded, ask sell-vs-hold once. After ANY reposition or route switch:
> update the memory file with new tokenIds/bands/routes, record the
> recenter in the trend-brake history, and REPLACE the band-edge price
> triggers with the new band's edges. Keep reports compact; if nothing
> changed and all in range, a 3-line holding report is enough.

**Stale-trigger rule (mandatory).** Any recenter moves the band, which
makes the old edge triggers wrong — either pointing deep inside the new
band (constant false fires) or at irrelevant prices. In the SAME session
as the recenter, delete the old band-edge triggers and create new ones
at the new band's edges. A reposition is not finished until its triggers
are refreshed.

**Model guidance.** Run every part of this skill — scheduled/triggered
manage passes AND transaction execution — on the best available frontier
model (see `recommended-models` in the frontmatter). Never let a model
improvise around a failed script or a failed tx.

## 6. State, recovery, and memory

State file: `~/.aero-stock-lp/state.json` — written by `settle`, read by
`manage`, cleaned by `exit finish`. Only TWO fields are unrecoverable
from chain: `entryUsd` and `enteredAt`. Everything else re-derives (and
`manage.mjs` does so on every pass). If state is lost, `manage` still
finds the positions; the basis shows `basisEstimated: true` — tell the
user loudly and ask for the real entry figure. Never let a lost file make
the book lie: the chain is the memory; the file is a cache.

**User memory file.** Where the runtime gives you a persistent user
memory file (the Bankr console does), keep ONE line in it about this
book — future sessions start with no conversation history, and the memory
line is how they learn positions exist at all:

> aero-stock-lp: active Aerodrome LP positions on Base — see
> ~/.aero-stock-lp/state.json. Manage with the aero-stock-lp skill.

Upsert after every entry/exit/recenter/route switch; delete it when the
last position closes. It is a POINTER, not a store.

**Post-reposition bookkeeping (mandatory, same session).** After ANY
recenter, route switch, or exit, before reporting done:
1. Update the state file / memory line with new tokenIds, bands, routes.
2. Record the recenter in the trend-brake history (direction + time) so
   future passes can enforce the brake across sessions.
3. Refresh the band-edge price triggers per §5's stale-trigger rule.
A reposition missing any of these three is incomplete — say so rather
than silently skipping.

## 7. Honest reporting — every report, no exceptions

- Value = principal + claimable fees/emissions + LOOSE wallet balances
  (mint remainders are real book money — `manage` includes them; a P&L
  that ignored them once showed −$17 on a healthy $1,223 position).
- P&L = value − entry basis. Divergence (impermanent) loss is real loss.
- Never promise or annualize a yield as if fixed. The only
  forward-looking number allowed is `projectedAprPct`, always labeled
  "at this epoch's rate" (resets Thursday) — gross and in-range-
  conditional. Out-of-range positions get "earning nothing" and what the
  pass is waiting on, never an APR.
- Estimated basis is flagged in the same line.
- CLAIMS TRANSPARENCY (mandatory on every exit/recenter report): state
  exactly what was claimed in the sequence, in one line — "claimed
  X AERO (~$Y) during unstake" and/or "collected $Z in fees" — or, when
  nothing accrued, say why: "0 AERO accrued — position was out of range
  before the exit." Mechanics for your explanation: `gauge.withdraw()`
  force-claims any accrued AERO on unstake; `collect` claims trading
  fees; an out-of-range position accrues nothing on either route. Never
  leave the user guessing whether a rebalance claimed their earnings.

Example shape (match it, don't pad it):

> NVDA: $1,240 (+$38, +3.2%), in range $168 – $182, earning AERO — ~41%
> APR at this epoch's rate.
> AAPL: $980 (−$12, −1.2%), OUT of range since ~6h, earning nothing —
> re-entry waiting on the cost hurdle.
> Total: $2,220, +$26 net. Emissions reset Thursday.

## 8. Contracts and markets (reference — `scripts/lib/markets.mjs` is canonical)

| Market | Token (token1, 8 dec) | Pool | tickSpacing | fee |
|---|---|---|---|---|
| NVDA | `0xb20000000000000000000078ee7ce2fE4908108C` | `0x853f5f1b92b16714fe6cda67caad0856b83c7ab9` | 10 | 0.05% |
| AAPL | `0xb200000000000000000000C2e324d24d7eEcd1fb` | `0xa3b1e3f9747065e2073722ff4c9027d3ea4994f0` | 10 | 0.05% |
| GOOGL | `0xb2000000000000000000002D0BA3164cc74f58B7` | `0xb1987cad1682841b4b641d50e520777ec5ab5542` | 10 | 0.05% |
| META | `0xb2000000000000000000008bC8786B856E61707C` | `0xeaf57753bc382e0324a1d43f72e7027705a2273e` | 10 | 0.05% |
| AERO (18 dec) | `0x940181a94A35A4569E4529A3CDfB74e38FD98631` | `0xCCd9cC53b63662088c738B8BC06E9078Fb8D9ad4` | 200 | 0.3% |

USDC `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` is token0 in every pool.
Equity tokens are Base-native predeploys, 8 decimals, 1:1 Coinbase-backed
(non-US program), trading 24/7 even when Nasdaq is closed. Gauges, NPMs,
routers, and factories live in `markets.mjs`.

**New listings.** Coinbase keeps adding tickers. To LP one that isn't in
the table: token address from an authoritative source only (Coinbase's
official listing or the verified Basescan contract — never a user-pasted
address alone; predeploys start `0xb2…` and must have 8 decimals). Add
the market to `MARKETS` in `scripts/lib/markets.mjs` (find the pool via
the canonical factories; equity family: NPM/router as the other equities,
tickSpacing 10), then run `selftest.mjs --live` — it verifies the pool's
gauge, tickSpacing, and reward token on-chain before you touch it. Treat
a fresh listing as extra-hostile: no entry in its first 48h and never
without a live real quote (the GOOGL pre-launch froth went $337 → $2,001
→ $456 in four days; LPs who provided into it were the exit liquidity).

## 9. What this skill refuses to do

- Enter a pool that fails ANY gate — including "the user is excited". The
  gates are exit codes, not suggestions; report the failing number.
- Recenter an in-range position — no matter which automation fired.
- Trade without a fresh real quote (entry and re-entry fail CLOSED).
- Promise or guarantee yields; the only projection is the labeled
  epoch-rate APR.
- Auto-sell without consent: compounding sells AERO only after the
  user's recorded `compound: "sell"`.
- Hand-build, edit, or re-prefix calldata, or skip a script: if the
  script can't produce the tx, the tx doesn't happen.
- Ask for per-transaction approvals mid-sequence: one confirmation per
  sequence, then execute.
- Silence a failure: every skipped step, estimated basis, degraded input,
  or stopped sequence is reported in plain language.
