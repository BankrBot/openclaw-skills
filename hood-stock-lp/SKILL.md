---
name: hood-stock-lp
description: LP tokenized stocks on Robinhood Chain — range-LP Robinhood tokenized equities (TSLA, SPCX, SPY, GOOGL, AAPL, NVDA, MSFT, GME, CRCL, USO, NFLX, INTC) against USDG on Uniswap v3 and v4 pools for trading-fee yield. Use when the user wants to LP stocks on Robinhood Chain, open/recenter/exit a position, check pool status, NAV, or yields, or get a portfolio overview ("how are my LP positions doing?") with P&L and projected APR. Bundled node scripts do the chain reads, gate checks, and calldata (both venues, byte-validated against the deployed forks); writes go via the Bankr arbitrary-transaction flow. NOT for perps, spot trading, or Aerodrome/Base (that is the aero-stock-lp skill).
---

# hood-stock-lp — LP tokenized equities on Robinhood Chain

Concentrated-liquidity market making on Robinhood Chain (chain 4663), where
Robinhood's tokenized stocks trade against USDG in Uniswap v3 AND v4 pools.
You place a price band around the market; the pool pays you trading fees
while price stays inside it. There are no gauges and no emissions here —
fees are the whole game, which makes this simpler than Aerodrome: no route
decisions, ever. Every rule in here was proven (or paid for) with real
money by the Midpoint engine that ran these exact pools.

**Division of labor.** The bundled `scripts/` (plain node >= 18, zero
dependencies) own everything deterministic: chain reads (batched via
Multicall3), entry gates (fail closed via exit codes), band/tick math with
per-pool orientation, calldata for BOTH venues, valuation, and P&L. You —
the model — own the judgment: which market, how much, fetching a fresh
real quote, choosing band width when asked, talking to the user, and
getting confirmations. Do NOT hand-build calldata or re-derive pool math
in conversation; run the script. If a script fails, relay its `detail`
and stop — never improvise around a failed gate.

**Operating model.** The user's funds stay in their own Bankr wallet. You
never hold keys, and neither do the scripts — they emit unsigned
`{to, data, value, chainId: 4663}` objects. You submit each via Bankr's
arbitrary-transaction flow, ONE AT A TIME: submit, wait until mined,
verify the receipt succeeded, then send the next. The sequence IS your
atomicity. Any tx failure → stop, report exactly where, and resume later
from chain state (a fresh script run), never from what you intended.

**Two venues, one skill.** Six markets live on Uniswap v3 pools, six on
v4 (the table below says which). The scripts dispatch automatically — the
flows, gates, and reports are identical either way. The only user-visible
difference: exits are ONE transaction on both venues (v3 bundles
decrease+collect+burn in the NPM's own multicall; v4 burns and takes both
sides in one `modifyLiquidities`).

**Talking to the user.** Short answers, plain language, lead with the
outcome. Rules:
- Routine reports are a few lines; the scripts' `report` fields are
  written to be relayed nearly verbatim. No tables of passing checks —
  gates run silently; mention only a FAILURE, in one line, with the
  number (the failing gate's `value` and `limit` are in the output).
- Prices, never ticks. "$324 – $369", not "-218520 to -217200". No
  contract internals, venue names, or protocol jargon unless asked.
- ONE confirmation before spending money ("Deposit $50 into the TSLA
  pool at $324 – $369? yes/no" — `plan` emits exactly this line), then
  execute the whole sequence without narrating each step. Report one
  final line with the position and a single tx link
  (robinhoodchain.blockscout.com/tx/…).
- Set the time expectation FIRST. The moment the user asks to LP (or
  exit), before you fetch a quote, run a script, or do anything else,
  send one line: "On it — LPing takes a few steps, usually 2–3 minutes.
  I'll check the market and come back for one confirmation before
  spending anything." Both quiet stretches — the checks before the
  confirmation and the transaction sequence after it — are covered by
  that one line; don't repeat it, just execute.
- Wider range = less chance of falling out of range (out of range earns
  nothing); tighter = higher share of fees while it lasts. Default to
  `standard` width without asking; explain only if the user asks about
  risk or yield.

**Gas.** Bankr handles gas on transactions it executes. NEVER check the
user's ETH balance, ask them to bridge or buy ETH, or mention gas before
executing. Only if Bankr itself returns a gas/funds error, relay that one
error and stop.

---

## 1. The scripts

Run from the skill directory. Every script prints ONE JSON object to
stdout: `{ok, …, txs[], report, next}`. `ok: false` + non-zero exit means
a gate failed — the failure is in `gate`/`detail`. `txs` are unsigned;
submit them in order via Bankr. `next` tells you the following command.

| Command | What it does |
|---|---|
| `node scripts/entry.mjs plan --market TSLA --usd 50 --wallet 0x… --quote 345.80 --quote-age-s 90 --iv 0.45` | Runs ALL entry gates (fail closed), builds the band, sizes the delta swap (buys the shortfall OR sells excess loose stock). Emits the user-confirmation line + swap txs. |
| `node scripts/entry.mjs size --market TSLA --usd 50 --wallet 0x… --tick-lower … --tick-upper …` | AFTER the swap mines: re-reads the pool (your own swap moved it), sizes the mint at post-swap state, budget-capped on both sides. Use the exact ticks from `plan`'s output. |
| `node scripts/entry.mjs settle --market TSLA --wallet 0x… --mint-tx 0x… --entry-usd 50 [--recenter-dir up\|down]` | AFTER the mint mines: extracts the tokenId from the receipt, records basis in the state file. Pass `--recenter-dir` when this entry is a recenter (feeds the trend brake). |
| `node scripts/manage.mjs --wallet 0x… [--quote-TSLA 345.80 …]` | The MANAGE PASS: discovers all positions from chain (both venues), values them honestly (loose balances included), checks range, applies the cost-hurdle / trend-brake verdicts. Pass fresh quotes for any market that might need a recenter. |
| `node scripts/exit.mjs begin --market TSLA --token-id N --wallet 0x…` | Exit phase 1, ONE tx: principal + fees land in the wallet (v3: decrease+collect+burn multicall; v4: burn+take). |
| `node scripts/exit.mjs finish --market TSLA --token-id N --wallet 0x… [--keep-stock]` | Exit phase 2 (after phase 1 mines): sell residual stock so the user lands in USDG (minOut 2% floor), remove from state. `--keep-stock` for recenters — the re-entry absorbs the stock instead of round-tripping it. |
| `node scripts/selftest.mjs [--live]` | Offline math + byte-for-byte encoding vectors (ground truth: the Midpoint engine's viem encoders); `--live` also verifies all 12 markets against mainnet. Run `--live` once on first use of this skill. |

Why entry is phased: there are transaction boundaries. Your own swap
moves the pool price, so the mint can only be sized after the swap mines;
sizing at the quote-time price once froze a $706 position for two days.
Between phases, YOU submit the txs via Bankr and check receipts.

## 2. Entry flow

1. Get the inputs: market, USD amount, a REAL quote fetched by you at
   entry time (your market-data access or web search; quotes older than
   ~15 min during market hours don't count), plus an ATM implied vol
   `--iv` if you can get one, else pass a 5-session expected move as
   `--w`. No honest vol input → the script refuses — never guess one to
   get past it.
2. `entry.mjs plan …` — on gate failure, tell the user the one failing
   number and stop. On pass, ask the user the `report` question verbatim
   (add one extra confirmation naming the share if
   `needsConcentrationConfirm` is true — "that's most of your USDG,
   sure?"). One yes = go.
3. Submit `plan`'s txs (if any), then `entry.mjs size` (command given in
   `next`), submit the mint, then `entry.mjs settle --mint-tx <hash>
   --entry-usd <usd>`.
4. Report one short line: amount, band in dollars, this pool's fee tier
   earning picture (never as a promise), one tx link. Mention once that
   "check my LPs" runs a management pass any time.
5. If the mint mined but `settle` can't find the tokenId, STOP and
   recover via `manage.mjs` (it discovers from chain) — never re-mint
   blind.

## 3. Manage pass (run on request)

Runs whenever the user asks ("check my LPs", "how are my positions?").
Encourage a daily check-in at minimum — more often for tight bands — and
say so when reporting a fresh entry. Idempotent: safe to repeat.

1. Fetch fresh equity quotes first if any position might be out of range,
   and pass them as `--quote-<MARKET>`; without a quote, re-entry after a
   recenter is BLOCKED (fail closed) though valuation still runs.
2. `node scripts/manage.mjs --wallet 0x…` — relay the `report` lines.
   Out-of-range positions come with the cost-hurdle / trend-brake
   verdicts already computed; follow the `action` field.
3. Out-of-range + hurdles passed → `exit.mjs begin`, `exit.mjs finish
   --keep-stock`, then a fresh `entry.mjs plan` with a fresh quote (all
   gates re-run) and `settle --recenter-dir <dir>` (the direction is in
   the manage output). The kept stock is absorbed by the new band's delta
   swap — never sold and re-bought.
4. Market-hours note: these pools trade 24/7, but real quotes go stale
   when US markets are closed — band re-derivation off-hours centers on a
   stale number. Prefer exiting to cash off-hours and re-entering when
   the quote is live again; say which you did.
5. If the output notes the v4 log-scan failed, say discovery was partial
   for v4 — do NOT conclude the v4 book is empty.

## 4. State, recovery, and memory

State file: `~/.hood-stock-lp/state.json` — written by `settle`, read by
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

> hood-stock-lp: active Uniswap LP positions on Robinhood Chain — see
> ~/.hood-stock-lp/state.json. Manage with the hood-stock-lp skill.

Upsert after every entry/exit/recenter; delete it when the last position
closes. It is a POINTER, not a store.

## 5. Honest reporting — every report, no exceptions

- Value = principal + uncollected fees + LOOSE wallet balances (mint
  remainders are real book money — `manage` includes them; a P&L that
  ignored them once showed −$17 on a healthy $1,223 position).
- P&L = value − entry basis. Divergence (impermanent) loss is real loss.
- Never promise or annualize a yield as if fixed. The only
  forward-looking number allowed is `projectedAprPct`, always labeled
  "at today's volume" — gross and in-range-conditional. Out-of-range
  positions get "earning nothing" and what the pass is waiting on, never
  an APR.
- Estimated basis is flagged in the same line.

Example shape (match it, don't pad it):

> TSLA: $1,240 (+$38, +3.2%), in range $324 – $369, earning fees — ~45%
> APR at today's volume.
> GME: $980 (−$12, −1.2%), OUT of range since ~6h, earning nothing —
> re-entry waiting on the cost hurdle.
> Total: $2,220, +$26 net.

## 6. Markets (reference — `scripts/lib/markets.mjs` is canonical)

USDG `0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168` (6 dec) is the cash
asset; every stock token is 18 dec. Tokens sort by address, so USDG lands
on either side per pool (`usdgIs0`) — the scripts handle the orientation
flip (it inverts the price↔tick map and swaps band ends; getting it
backwards mints an instantly-out-of-range position).

| Market | Venue | Fee | Breaker |
|---|---|---|---|
| GME | v3 | 1% | 5% |
| SPCX (SpaceX) | v4 | 1% | 15% |
| SPY | v4 | 0.05% | 5% |
| TSLA | v4 | 0.3% | 8% |
| GOOGL | v4 | 0.3% | 8% |
| CRCL | v4 | 0.3% | 10% |
| MSFT | v3 | 0.3% | 5% |
| AAPL | v4 | 0.3% | 5% |
| USO | v3 | 0.3% | 8% |
| NFLX | v3 | 0.3% | 8% |
| NVDA | v3 | 0.05% | 8% |
| INTC | v3 | 0.3% | 8% |

Breaker = per-market daily-move circuit breaker (the vol-brake gate). One
size does NOT fit all: a 5% brake fits GME; SPCX is a young listing that
swings 9–16% day-over-day — braking it at 5% means permanently frozen.

**New listings.** Robinhood keeps adding tickers. To LP one that isn't in
the table: token address from an authoritative source only (never a
user-pasted address alone), find the pool AND prove its economics before
pinning — enumerate candidate pools across both venues and all fee
tiers, and pick by fee-yield-per-dollar (fee × 24h volume ÷ TVL). A
market was once pinned to a 1% pool doing $6k/day while the canonical
0.3% pool did $1.1M/day — a 9× yield difference discovered by a user.
Add the market to `MARKETS` in `scripts/lib/markets.mjs` (verify
`usdgIs0` from the pool's actual token ordering), then run
`selftest.mjs --live` — it verifies orientation, fee, and price sanity
on-chain before you touch it. Treat a fresh listing as extra-hostile: no
entry in its first 48h and never without a live real quote (a pre-launch
pool once went $337 → $2,001 → $456 in four days; LPs who provided into
the froth were the exit liquidity).

## 7. What this skill refuses to do

- Enter a pool that fails ANY gate — including "the user is excited". The
  gates are exit codes, not suggestions; report the failing number.
- Trade without a fresh real quote (entry and re-entry fail CLOSED).
- Promise or guarantee yields; the only projection is the labeled
  today's-volume APR.
- Hand-build calldata or skip a script: if the script can't produce the
  tx, the tx doesn't happen.
- Silence a failure: every skipped step, estimated basis, degraded input,
  or stopped sequence is reported in plain language.
