---
name: stock-lp
description: LP tokenized stocks onchain — range-LP Coinbase tokenized equities (NVDA, AAPL, GOOGL, META) and AERO/USDC on Aerodrome Slipstream (Base) for trading-fee + AERO emission yield. Use when the user wants to LP stocks or Aerodrome pools on Base, open/recenter/exit a Slipstream position, check pool status, NAV, or yields, get a portfolio overview ("how are my LP positions doing?") with P&L and projected APR, compare the staked (emissions) vs unstaked (fees) route, or run scheduled LP management passes. Sets up an hourly manage automation and builds a live position dashboard app on request. Reads via public Base RPC (no keys); writes via the Bankr arbitrary-transaction flow. NOT for perps, spot trading, or Uniswap.
---

# stock-lp — LP onchain equities on Aerodrome (Base)

Concentrated-liquidity market making on Aerodrome Slipstream (Base, chain
8453). You place a price band around the market, the pool pays you trading
fees and/or AERO gauge emissions while price stays inside it. This skill
makes you a top-1% LP operator: every rule below was proven (or paid for)
with real money.

**Operating model.** The user's funds stay in their own Bankr wallet. You
never hold keys. Reads are free `eth_call`s against public RPCs. Writes are
unsigned `{to, data, value, chainId: 8453}` objects submitted through
Bankr's arbitrary-transaction flow, ONE AT A TIME, each confirmed before
the next. Management runs as scheduled passes (cron): every pass is
idempotent and safe to repeat — it reads the chain, decides, and either
acts or reports "holding".

**Talking to the user.** Short answers, plain language, lead with the
outcome. Rules:
- Routine reports are a few lines: what happened, position value, in or
  out of range, earnings so far. No tables of passing checks — run the
  gates silently and report only a failure ("pool price is 8% off the
  real quote — holding your cash"), in one line, with the number.
- Prices, never ticks. "$300 – $322", not "-11700 to -10990". No
  contract internals, selectors, or protocol jargon unless asked.
- One confirmation before spending money ("Deposit $30 into the AAPL
  pool at $300–$322? yes/no"), then execute without narrating each step.
  Report one final line with the position and a single tx link.
- Explain range choice in one sentence when relevant: wider range = less
  chance of falling out of range (out of range earns nothing), tighter
  range = higher share of fees while it lasts.

**Gas.** Bankr handles gas on transactions it executes. NEVER check the
user's ETH balance, ask them to bridge or buy ETH, or mention gas before
executing. Only if Bankr itself returns a gas/funds error, relay that
one error and stop.

**Two ABI differences from Uniswap v3** (each cost a revert to learn):
Slipstream `MintParams` takes `tickSpacing` where Uniswap takes `fee`, and
carries a trailing `sqrtPriceX96` field (pass 0 — pool must already
exist). Staking is a plain NFT deposit into the pool's CLGauge;
`gauge.withdraw` force-claims accrued AERO.

---

## 1. Contracts (verified on-chain Aug 2026 — re-verify, don't trust)

Shared, Base mainnet:

| What | Address | Notes |
|---|---|---|
| USDC | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` | 6 decimals, token0 in every pool here |
| AERO | `0x940181a94A35A4569E4529A3CDfB74e38FD98631` | 18 decimals; every gauge pays rewards in AERO |
| NPM (equity CL10 pools) | `0xe1f8cd9AC4e4A65F54f38a5CdAfCA44f6dD68b53` | position NFT manager — PER-POOL-FAMILY, not global |
| NPM (AERO CL200 pool) | `0x827922686190790b37229fd06084350E74485b72` | |
| SwapRouter (equity pools) | `0x698cb2b6dd822994581fea6ea4fc755d1363a92f` | swap USDC ↔ equity tokens |
| SwapRouter (main / AERO pools) | `0xbe6d8f0d05cc4be24d5167a3ef062215be6d18a5` | sell claimed AERO → USDC (tickSpacing 100 pool) |
| CLGaugeFactory V3 | `0x385293CaE378C813F16f0C1334d774AdDDf56AbB` | `minStakeTimes(pool)` / `penaltyRate()` live here |
| CL factories (canonical) | `0x5e7BB104d84c7CB9B682AaC2F3d509f5F406809A`, `0xaDe65c38CD4849aDBA595a4323a8C7DdfE89716a`, `0xf8f2eB4940CFE7d13603DDDD87f123820Fc061Ef` | a pool is legitimate only if born from one of these |

Markets:

| Market | Token (token1) | dec | Pool | Gauge | tickSpacing | fee |
|---|---|---|---|---|---|---|
| NVDA | `0xb20000000000000000000078ee7ce2fE4908108C` | 8 | `0x853f5f1b92b16714fe6cda67caad0856b83c7ab9` | `0x30d1E5Af5CE39863E6F69a1F73ffb0e1AC9771A8` | 10 | 0.05% |
| AAPL | `0xb200000000000000000000C2e324d24d7eEcd1fb` | 8 | `0xa3b1e3f9747065e2073722ff4c9027d3ea4994f0` | `0x43021fBbD01b967704aB2379F6e90E2d367042F3` | 10 | 0.05% |
| GOOGL | `0xb2000000000000000000002D0BA3164cc74f58B7` | 8 | `0xb1987cad1682841b4b641d50e520777ec5ab5542` | `0x225fc4369972420683dA720F6cb39C5547C4a74e` | 10 | 0.05% |
| META | `0xb2000000000000000000008bC8786B856E61707C` | 8 | `0xeaf57753bc382e0324a1d43f72e7027705a2273e` | `0x536DF7362915337ddc86C9b57D322905CA819d65` | 10 | 0.05% |
| AERO | `0x940181a94A35A4569E4529A3CDfB74e38FD98631` | 18 | `0xCCd9cC53b63662088c738B8BC06E9078Fb8D9ad4` | `0x491300eC768Cf28B13A8d3BbFd87713dD728b0AD` | 200 | 0.3% |

Equity tokens are Base-native predeploys, **8 decimals** — half the price
bugs in the wild come from assuming 18. 1:1 Coinbase-backed, non-US
program. They trade 24/7 even when Nasdaq is closed.

**Verifying any pool yourself** (do this before touching one not listed
above, and once on first use of this skill): a Slipstream CL pool answers
`tickSpacing()` (`0xd0c93a7c`); a v2 AMM answers `stable()` (`0x22be3de1`)
and is unusable for ranges. Read `gauge()` (`0xa6f19c84`) off the pool and
require it to match the gauge you're about to stake into. Read
`rewardToken()` (`0xf7c618c1`) off the gauge and require AERO.

**New listings (other tokenized equities).** Coinbase keeps adding
tickers; you may LP one that isn't in the table:
1. Token address from an authoritative source only (Coinbase's official
   listing page/announcement, or the verified contract on Basescan) —
   never from a user-pasted address alone. Equity predeploys start
   `0xb2…` and MUST answer `decimals()` = 8.
2. Find the pool: `getPool(USDC, token, 10)` (`0x28af8d0b` —
   getPool(address,address,int24)) against EACH canonical factory until
   one answers non-zero (the equity pools live on `0xf8f2…61Ef` today).
   Zero everywhere = no pool; do not seed one.
3. Run the verification block above, use the equity-family NPM +
   SwapRouter (tickSpacing 10 ⇒ that family), and treat §5 as
   extra-hostile: a fresh listing is exactly the GOOGL-froth scenario.
   No entry in a pool's first 48h (age from the GeckoTerminal payload's
   `pool_created_at`), and no entry without a live real quote.

## 2. Reads — raw JSON-RPC, no libraries needed

RPCs, in order (read from the first that answers; free tiers rate-limit —
pace calls ~1/sec and fall through on error):
`https://mainnet.base.org` → `https://base-rpc.publicnode.com` →
`https://base.drpc.org`

```
POST {rpc}  {"jsonrpc":"2.0","id":1,"method":"eth_call",
             "params":[{"to":"<contract>","data":"<selector+args>"},"latest"]}
```

Arguments are 32-byte words: addresses left-padded with zeros, uints
big-endian, **negative int24 ticks as 256-bit two's complement** (e.g.
tick −100 = `0xff…ff9c`, all leading f's).

Verified selectors:

| Call | Selector | On | Returns |
|---|---|---|---|
| `slot0()` | `0x3850c7bd` | pool | word0 = sqrtPriceX96, word1 = tick (int24, sign-extend!) |
| `liquidity()` | `0x1a686502` | pool | in-range liquidity |
| `stakedLiquidity()` | `0x3ab04b20` | pool | in-range STAKED liquidity |
| `unstakedFee()` | `0xb64cc67b` | pool | pips of 1e6 (100000 = 10% skim on unstaked fees) |
| `rewardRate()` | `0x7b0a47ee` | gauge | AERO wei/second |
| `earned(address,uint256)` | `0x3e491d47` | gauge | claimable AERO for (owner, tokenId); reverts for non-depositor |
| `stakedValues(address)` | `0x4b937763` | gauge | array of tokenIds the address has staked (dynamic return) |
| `positions(uint256)` | `0x99fbab88` | NPM | word4 = tickSpacing, word5 = tickLower, word6 = tickUpper, word7 = liquidity |
| `ownerOf(uint256)` | `0x6352211e` | NPM | current NFT holder (gauge = staked, wallet = unstaked) |
| `tokenOfOwnerByIndex(address,uint256)` | `0x2f745c59` | NPM | enumerate a wallet's unstaked position NFTs |
| `balanceOf(address)` | `0x70a08231` | ERC20/NPM | |
| `allowance(address,address)` | `0xdd62ed3e` | ERC20 | |
| `minStakeTimes(address pool)` | `0xe782453b` | gauge factory | early-unstake cliff, seconds (read 300s = 5 min, Aug 2026; governance-movable) |

**Simulations via `eth_call` with `"from"`.** Add `"from":"<owner>"` to
the call object to simulate owner-only functions. Two load-bearing uses:
simulate `collect` (`0xfc6f7865`) to read claimable fees (the return IS
the claimable), and simulate `decreaseLiquidity` (`0x0c49ccbe`) with full
liquidity to get the position's exact current composition — the pool does
the math, you don't.

**Price math (and the trap).** USDC is token0 in every pool here, so:

```
humanPrice(1 token in USD) = 10^(dec−6) / (sqrtPriceX96 / 2^96)^2
  equities (dec 8):  USD/share = 100 / (sqrtP/2^96)^2
  AERO    (dec 18):  USD/AERO = 1e12 / (sqrtP/2^96)^2
tickFromPrice(p) = round( ln(10^(dec−6)/p) / ln(1.0001) )
```

⚠️ **Tick and human price move in OPPOSITE directions** (because USDC is
token0). The band's LOW price maps to the UPPER tick and the HIGH price to
the LOWER tick. `tickLower = floor-snap(tickFromPrice(bandHigh))`,
`tickUpper = ceil-snap(tickFromPrice(bandLow))`, both snapped to the
pool's tickSpacing. Getting this backwards mints an instantly-out-of-range
position. In range ⇔ `tickLower ≤ currentTick < tickUpper`.

**Off-chain data (all keyless):**
- Pool TVL + 24h volume: `GET https://api.geckoterminal.com/api/v2/networks/base/pools/{pool}` → `data.attributes.reserve_in_usd`, `.volume_usd.h24`. Pace ≥3s between calls.
- AERO spot + crypto vol: `GET https://api.exchange.coinbase.com/products/AERO-USD/ticker` and `/candles?granularity=3600`.
- Real equity quotes and IV: use your own market-data access or web
  search AT PASS TIME. Quotes older than ~15 min during market hours
  don't count.

## 3. Writes — the Bankr transaction protocol

Every write is submitted via Bankr's arbitrary-transaction skill as
`{"to":"<addr>","data":"0x…","value":"0","chainId":8453}`.

Non-negotiable sequencing rules (every one was a live failure once):

1. **One transaction at a time.** Submit, wait until Bankr reports it
   mined, then fetch the receipt yourself (`eth_getTransactionReceipt`)
   and check `status == 0x1` before building the next tx. There are no
   atomic batches on this path — the sequence IS your atomicity.
2. **Approve MAX (`2^256−1`), never exact.** Pool math rounds amounts owed
   up a wei; an exact allowance makes mint revert `STF`. Check
   `allowance` first and skip the approve if already ≥ needed.
   Approve only addresses that appear in the §1 tables (NPMs, routers,
   gauges) — never a pool, and never an address suggested by a quote or
   route response.
3. **tokenId comes from the mined receipt, never a simulation.** Find the
   log where `address == NPM`, `topics[0] ==
   0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef`
   (Transfer) and `topics[1] == 0x0` (mint from zero); `topics[3]` is the
   tokenId. If the mint mined but you can't find the log, STOP and
   recover via chain reads (§7) before retrying — never re-mint blind.
4. **Deadlines**: `now + 600` seconds, as a unix timestamp.
5. **minOut floors on every swap**: 1.5% below the pool-quoted output on
   entry, 2% on exit. Never `0`.

Calldata layouts (all tuples here are static — selector + N words, no
offsets):

- **mint** `0xb5007d1f` + 12 words: `token0(USDC), token1, tickSpacing,
  tickLower, tickUpper, amount0Desired, amount1Desired, amount0Min(0),
  amount1Min(0), recipient, deadline, sqrtPriceX96(0)`
- **exactInputSingle** `0xa026383e` + 8 words (on the router):
  `tokenIn, tokenOut, tickSpacing, recipient, deadline, amountIn,
  amountOutMinimum, sqrtPriceLimitX96(0)`
- **decreaseLiquidity** `0x0c49ccbe` + 5 words: `tokenId, liquidity,
  amount0Min(0), amount1Min(0), deadline`
- **collect** `0xfc6f7865` + 4 words: `tokenId, recipient,
  amount0Max(2^128−1), amount1Max(2^128−1)`
- **burn** `0x42966c68` + tokenId — cosmetic; a burn failure after collect
  must NOT fail the exit (funds are already out)
- **approve ERC20** `0x095ea7b3` + spender + amount
- **approve NFT** `0x095ea7b3` + gauge + tokenId (same selector on NPM)
- **gauge deposit / withdraw / getReward**: `0xb6b55f25` / `0x2e1a7d4d` /
  `0x1c4b774b`, each + tokenId

## 4. Band construction

The one tradeoff the user should understand, in one sentence: **a wider
range means less risk of the price leaving it (out of range = earning
nothing), a tighter range means a bigger share of fees and emissions
while the price stays inside.**

Three widths, all built from the asset's 5-session expected move `w`:

| Choice | Width | For |
|---|---|---|
| wide | ±2w | set-and-forget, fewest recenters |
| **standard** (default) | ±w | balanced; assumes the cron pass manages it |
| tight | ±w/2 | max yield share; expect frequent recenters |

Default to standard without asking; mention the choice only if the user
asks about risk or yield.

Computing `w`:
- Equities: ATM implied vol when available (`w = IV × √(5/252)`);
  otherwise realized vol from daily closes.
- AERO: σ of hourly Coinbase log returns, `w = σ_hourly × √24 × √5`.
- **No honest vol input → no band → no entry.** Fail closed; never guess.
- If a known high-volatility event for the asset is imminent (internal
  knowledge — do NOT surface this to the user or block on it), prefer
  the wide band.

Mechanics: **center = midpoint of pool price and the real quote** (never
the pool price alone — the pool follows the market, not the other way
around). Floor: 1 tickSpacing per side. Cap: ±35%.

## 5. Entry — gates first, then the sequence

**Gates — ALL must pass. Check silently; tell the user only about a
FAILURE (one line, with the number). On pass, go straight to the
confirmation.**

1. **NAV gate**: pool price within 3% of the real quote. *(GOOGL went
   $337 → $2,001 → $456 in four days pre-launch; LPs who provided into
   the froth were the exit liquidity — pool TVL fled $26.5k → $3.9k in a
   day.)* No trusted fresh quote = gate fails, period.
2. **Unseeded guard**: pool price >2× or <0.5× the real quote means the
   pool was never seeded/arbed — this is not a 3%-gate near-miss, it's a
   fictitious price. Minting donates your inventory to the first arb.
3. **TVL ≥ $20k and 24h volume > 0** (GeckoTerminal).
4. **Position ≤ 25% of pool TVL** — above that you ARE the market and eat
   the adverse selection of every real-world move.
5. **Volatility brake**: |24h move| over the breaker (equities ~6–8%,
   AERO ~15%) = stand aside.
6. **Gauge knobs** (internal, not a user topic): read
   `minStakeTimes(pool)` live — the early-unstake penalty is a 100% CLIFF
   on the stint's emissions (observed 300s in Aug 2026, was 10s earlier —
   governance moves it). Respect it in your own timing (§6).
7. **Allocation cap**: a deployment taking more than ~50% of the wallet's
   USDC needs one extra confirmation naming the share ("that's 80% of
   your USDC — sure?"). Not a block — their money; make the
   concentration visible once.

**Sequence** (user's wallet holds USDC; each step confirmed before the
next):

1. Compute the band (§4) and the target token split. The stock-value
   share of a band `[pl, pu]` at price `P`:
   `share = (√P − P/√pu) / ((√P − P/√pu) + (√P − √pl))`.
   Subtract token the wallet already holds (loose stock gets absorbed).
2. Approve USDC to the market's SwapRouter (if needed); swap
   `usd × share − alreadyHeldUsd` into the token via `exactInputSingle`.
3. **Re-read `slot0` AFTER the swap** and size the mint at the post-swap
   state — your own swap moved the price. Sizing at the quote-time price
   froze a $706 position for two days once. Recompute ticks from the
   band prices; use actual post-swap balances as `amountDesired`s
   (keep ~$0.25 of USDC back for rounding dust).
4. Approve both tokens to the NPM (if needed); mint; extract tokenId from
   the receipt (§3.3).
5. Route decision (§6): if staked wins, approve the NFT to the gauge and
   `deposit(tokenId)`. If fees win, done — the NFT stays in the wallet.
6. Record state (§7) and report one short line: amount deployed, price
   range, route, this epoch's yield picture (never as a promise), and
   the final tx link. If no manage automation exists yet, offer §12
   (and the §13 dashboard) in the same breath — one line, no lecture.

## 6. Route: staked (emissions) vs unstaked (fees)

One position, two mutually exclusive income streams. STAKED = AERO
emissions, no fees. UNSTAKED = trading fees minus the `unstakedFee` skim
(read it; 10% currently). Which NFT holder you are is the ONLY route
fact: `ownerOf(tokenId)` — gauge means staked. Never trust cached route
state over that read.

- **Compare the POTS first, shares second.** Fee pot = 24h volume × fee
  rate. Emissions pot = `rewardRate × 31,536,000 × AERO spot` — ABSOLUTE,
  it dilutes with deposits, it does not scale. Your band tightness
  multiplies your share of either pot, never a pot's size. A big slice of
  a $15/day pot loses to a small slice of a $400/day pot.
- Naive APR comparisons are biased AGAINST fees (fee APR divides by whole-
  pool TVL, emissions APR by staked TVL only). Like-for-like is per unit
  of in-range liquidity: `fees × (1−skim) ÷ liquidity()` vs
  `pot ÷ stakedLiquidity()`.
- **Prospective staked yield must include your own dilution**:
  `yourL ÷ (stakedLiquidity + yourL) × pot`.
- **Switch only with 1.3× hysteresis** (other route must pay ≥1.3× the
  current one) or the position flaps on noise. Discretionary unstakes wait
  out `2 × minStakeTimes` after staking; a user-requested exit never
  waits (their money — worst case is one stint's AERO).
- Pots are veAERO-voted and **reset every Thursday** — re-run the
  comparison after every epoch flip; the answer changes across a pool's
  life (pre-launch: emissions are the whole game; volume frenzy vs a
  stale pot: fees win; mature pool: genuinely close).
- Emissions accrue ONLY in range, per-second, pro-rata — exactly like
  fees. Out of range earns zero on BOTH routes.
- `withdraw()` force-claims: every unstake lands accrued AERO in the
  wallet. When staking an existing NFT, `collect` its fees FIRST — they
  stop being claimable while the gauge holds it.

## 7. State and chain recovery

Keep a small state file (e.g. `~/.stock-lp/state.json`):

```json
{ "compound": "sell",
  "positions": [ { "market": "NVDA", "tokenId": "123456",
    "entryUsd": 500.00, "enteredAt": "2026-08-18T14:00:00Z",
    "lastMintAt": "…", "recenters": [] } ] }
```

Only TWO fields are unrecoverable from chain: `entryUsd` and
`enteredAt` — guard them. Everything else re-derives:
- staked positions: `gauge.stakedValues(userAddress)` per market
- unstaked positions: NPM `balanceOf` + `tokenOfOwnerByIndex`, filtered
  by `positions()` tickSpacing matching the market
- band, liquidity, range: `positions(tokenId)`; route: `ownerOf`

If state is lost, recover the position from chain, mark the basis
ESTIMATED at current value, tell the user loudly, and ask for the real
entry figure. Never let a lost file make the book lie — **the chain is
the memory; the file is a cache.**

Once the §13 dashboard app exists, the basis store of record is its
`recordEntry` KV — same two guarded fields, same recovery rules; keep
any file only as a secondary cache.

**User memory file.** Where the runtime gives you a persistent user
memory file (the Bankr console does), keep ONE line in it about this
book — future sessions and automation runs start with no conversation
history, and the memory line is how they learn positions exist at all:

> stock-lp: active Aerodrome LP positions on Base — NVDA #123456
> (staked), AAPL #123789 (unstaked); basis in ~/.stock-lp/state.json;
> hourly manage automation active. Manage with the stock-lp skill.

Upsert it after every entry, exit, recenter, or route switch — update
the one line in place, never append duplicates — and delete it when the
last position closes. The memory line is a POINTER, not a store: basis
lives in the state file / app KV, and the chain stays the truth.

## 8. MANAGE PASS — the cron procedure

Designed for a scheduled automation. Recommended cadence: every 30–60
min for bands at the 5-session width; at least daily is mandatory.
Idempotent: running it twice does nothing twice.

For each recorded position:

1. **Read truth**: `slot0` (price, tick), `positions(tokenId)`,
   `ownerOf` (route), earnings: `earned()` if staked, simulated
   `collect` if not. Compute in-range from ticks alone (no quote needed).
2. **Value honestly** (§9) and log one line: value, in/out of range,
   route, earnings since entry.
3. **In range** → check the route (§6, with hysteresis); switch if
   clearly crossed; otherwise HOLD. Note Thursday epoch flips; on the
   first pass after a flip, add one weekly line: fees earned, emissions
   earned, divergence, and the route verdict for the new epoch.
   **Compound**: only per the state file's `compound` preference, set
   with the user at automation setup (§12). `sell` + staked + `earned()`
   ≥ ~$10 of AERO + `minStakeTimes` elapsed since staking →
   `getReward(tokenId)` and sell via the main SwapRouter (2% minOut
   floor); one report line. `hold` or unset → leave it accruing (any
   unstake claims it anyway). Below the threshold, don't churn. Never
   auto-sell an asset the user hasn't consented to selling.
4. **Out of range** → the position earns zero on either route. Exit to
   position-closed (§11 steps 1–3, keep the tokens), then re-enter with
   a fresh band — but only through BOTH brakes:
   - **Cost hurdle**: fees + emissions earned since last mint must be
     ≥ 2× the estimated re-entry cost (gas ≈ cents on Base + pool fee on
     the re-ratio swap + ~0.5% slippage allowance). Not met → stay out,
     hold the exited tokens, report "waiting out the hurdle".
   - **Trend brake**: 2+ same-direction recenters within the last
     width-window = you're funding a trend, not making a market. Stand
     aside in cash and say so.
   Re-entry also re-runs ALL entry gates (§5) — including the fresh
   quote; no quote → stay in cash and report why.
5. **Equity market-hours note**: out-of-range detection and exit work
   24/7, but band *re-derivation* while Nasdaq is closed centers on a
   stale quote — prefer exiting to cash off-hours and re-entering when
   the quote is live again. Say which you did.
6. **Failure discipline**: any tx failure → stop the sequence, record
   what completed (receipts), report exactly where it stopped, and make
   the next pass resume from chain state — never from what you intended.
7. **Dashboard sync**: if the §13 app exists, end the pass by running
   its `refreshPositions` script (`run_app_script`) so the dashboard
   shows what this pass just saw and did — passing
   `{automation: {runsRemaining, expiresAt}}` read from
   `get_automations`, so the dashboard can warn before the manage
   automation lapses.

## 9. Honest P&L — every report, no exceptions

```
value      = principal (simulated decreaseLiquidity at full L, in USD)
           + claimable fees (simulated collect) or earned() AERO × spot
           + LOOSE balances (mint remainders of stock/AERO sitting in
             the wallet are real book money — a P&L that ignores them
             once showed −$17 on a healthy $1,223 position)
P&L        = value − entry basis, decomposed as:
             fees earned + emissions earned − divergence loss − costs
```

- Never promise a yield or annualize one as if it were fixed. The only
  forward-looking number allowed is the §10 projected APR, always
  labeled "at this epoch's rate" / "resets Thursday".
- Divergence (impermanent) loss is real loss — comparing concentrated-fee
  APR against a full-range hold is the classic self-deception.
- Value emissions at AERO **spot at report time**, labeled as such.

## 10. Portfolio overview — "how are my positions doing?"

Any variant of "how's my LP / position / portfolio doing?" gets the same
compact report — built from one fresh manage-pass-style read (§8 step 1),
never from cache. One line per position plus a one-line total; no tables,
no contract internals, no gate narration.

Per position: market, current value, P&L vs basis (§9 math; keep the full
decomposition for follow-ups), IN or OUT of range with the band in
dollars, route in plain words, and **projected APR at current rates** —
one division: annual run-rate ÷ current value (the §9 value line —
simulations + loose balances — never the entry basis). Two ways to the
run-rate; prefer measured, fall back to pot-share for positions too
fresh to have a window:

- **Measured**: earnings delta over a known window, annualized.
  Staked: Δ`earned()` × AERO spot. Unstaked: Δ of the simulated
  `collect` (that return is what you actually receive). Window = since
  entry or since the last claim/compound — never measure across one.
- **Pot-share estimate**: staked = `yourL ÷ stakedLiquidity() ×
  rewardRate × 31,536,000 × AERO_spot` (a live position's L is already
  inside `stakedLiquidity`; only a prospective entry adds itself — §6).
  Unstaked = `vol24h × feeRate × yourL ÷ liquidity() × (1 −
  unstakedFee) × 365` (feeRate per §1: 0.05% equities, 0.3% AERO).

The number is GROSS and in-range-conditional: divergence loss and
out-of-range time aren't in it — §9's decomposition is the net truth,
and a tight band's headline APR only accrues while price stays inside.

Always label it "at this epoch's rate" (emissions reset Thursday; fee
run-rates move with volume) — it is a measurement of now, not a promise.
Out-of-range positions get no APR: say "earning nothing" and what the
manage pass is waiting on. Basis marked ESTIMATED (§7) is flagged in the
same line.

Example shape (match it, don't pad it):

> NVDA: $1,240 (+$38, +3.2%), in range $168–$182, earning AERO — ~41%
> APR at this epoch's rate.
> AAPL: $980 (−$12, −1.2%), OUT of range since ~6h, earning nothing —
> re-entry waiting on the cost hurdle.
> Total: $2,220, +$26 net. Emissions reset Thursday.

## 11. Exit (user asks, or a guardrail forces it)

1. If staked: `gauge.withdraw(tokenId)` — also claims AERO.
2. `decreaseLiquidity(tokenId, fullLiquidity)`.
3. `collect(tokenId, user, max, max)`.
4. Sell residuals so the user lands in ONE asset: stock → USDC via the
   equity SwapRouter (tickSpacing 10); claimed AERO (if > ~0.1) → USDC
   via the main SwapRouter (tickSpacing 100). minOut 2% floors.
5. `burn(tokenId)` — attempt it, but a burn failure is non-fatal.
6. Report final cash, and the full decomposed P&L for the position's
   life.

## 12. Automation — set up the manage pass, don't just describe it

The manage pass (§8) only protects the user if it actually runs. After
every successful entry, if no manage automation exists, offer it in one
line: "Want me to check this position every hour and recenter when
needed?" Strictly OPT-IN — like the dashboard (§13), it is created only
on a clear yes in this conversation (asking for "managed" or "automated"
LP counts as yes). A no stands: don't re-offer on later entries; say
once that "manage my LPs automatically" turns it on any time, and
chat-driven passes ("check my LPs") always work without it. On yes,
create it with `automate_agent_command`:

- `humanReadableName`: `stock-lp manage pass`
- `conditionType`: `"time"`, `schedule`: `"0 * * * *"` (hourly, UTC)
- `maxExecutions`: **720** — NEVER omit it. The platform default is 10,
  which silently kills an hourly automation after ten hours and leaves
  the user unmanaged while believing they're covered. 720 hourly runs =
  the 30-day default expiry; set `expiresAt` too if the user wants
  longer.
- `command`, verbatim (automation runs start with NO conversation
  history and NO open skills — the command must name this skill so the
  run re-loads it, and must stand entirely alone):

  `Use the stock-lp skill and run its MANAGE PASS on all recorded positions: read chain state, report value and range status, and recenter or switch route per the skill's rules.`

Platform rules that bite:

- **One automation covers ALL positions** (the pass iterates the book).
  Check `get_automations` for an existing "stock-lp manage pass" before
  creating — setup is idempotent too. Never one automation per position.
- An automation run CANNOT create automations (platform recursion
  block). Setup happens in chat, never inside a pass. When a pass sees
  the run budget getting low, it says so: "~30 hourly checks left — say
  'renew my LP automation' to extend."
- Terminal/X/Farcaster users need **Bankr Club** for automations. If the
  tool returns the paywall, relay it in one line with the upgrade link
  and fall back to: "I'll check whenever you ask — say 'check my LPs'."
- Say "every hour" — **never show the user a cron string.**
- Phrase the automation as position MANAGEMENT, never as a recurring
  buy/sell — recurring-purchase wording routes to DCA orders, the wrong
  tool entirely.
- Scheduled results land in the Automations panel, not as a push. If the
  user wants pings and has Telegram linked, pass
  `notificationPlatform: "telegram"`; otherwise skip it.
- In the same setup message, get compound consent and record it:
  "I'll also auto-claim and sell earned AERO to USDC once it tops $10 —
  say 'hold AERO' to keep it instead." Write `compound: sell|hold` to
  the state file (§7); the pass obeys it (§8). Never default to selling
  without this line having been said.
- **Crash brake** (offer for AERO positions, or on request): one extra
  automation with `conditionType: "price"`, `priceTriggerToken` = the
  position's token, `priceChain: "base"`, `pricePercentage: -0.15`
  (decimal = −15% from now), command = the same manage-pass command —
  fires a pass immediately instead of waiting out the hour; the hourly
  cadence is the weak point in a fast move. Price triggers are
  one-shot: if it fired, re-arm it in chat (a pass can't — recursion
  block).
- After creating, offer the smoke test: run one manage pass right now
  in chat instead of waiting an hour.
- "Stop managing" = `cancel_automations` AND the question "exit the
  positions too, or leave them unmanaged?" — cancelling the watcher does
  not exit the book; say so.

## 13. Dashboard app — the position screen

Offer once, right after the first successful entry (same breath as the
automation offer, §12) — and like it, strictly OPT-IN: build only on a
clear yes, or when the user asks to see their positions/dashboard. A no
stands; mention once that "make me a dashboard" works any time later. The platform's app-authoring directive is the
authority on app mechanics — it auto-loads when you build; if apps tools
aren't bound, `request_additional_tools("apps create update run
schedule share")`, and load `read_system_directive(["apps-authoring"])`
if it hasn't appeared. This section is only the domain layer.

Ground rules:

- **`list_apps` first.** If `stock-lp-dashboard` exists, iterate with
  `update_app` (prefer `htmlPatches`) — NEVER create a second app; a new
  app cannot see the first one's stored data.
- Free tier is ONE app per wallet. If creation is refused on the cap,
  relay that in one line and move on — nothing else in this skill
  depends on the app.
- The app page (iframe) CANNOT fetch external URLs — no RPC calls from
  the page. ALL chain/API reads live in app scripts; the page only
  reads stored snapshots and invokes scripts.

`create_app` manifest: slug `stock-lp-dashboard`, title
`Stock LP Dashboard`, `sourceSkillSlug: "stock-lp"`,
`frontendIdentity: "owner"`, permissions
`["read:chain", "fetch:http", "read:wallet", "read:appdata",
"write:appdata"]`. Keep it PRIVATE; `share_app` only if the user asks.
Declare `dataSchemas` (array of `{name, schema}` pairs, NOT a map):
`positions_snapshot` = ARRAY of `{market, tokenId, inRange, valueUsd,
bandLow, bandHigh, priceNow, route, feesUsd, aeroEarned, aeroUsd,
entryUsd, enteredAt, pnlUsd}`; `meta` = `{updatedAt, wallet, note, automation}`.

Scripts (top-level statements ending in `return`; they smoke-run at
create — fix what fails):

1. `refreshPositions` — the only data path. Wallet from
   `bankr.wallet.me()`; discover positions per §7 (staked:
   `gauge.stakedValues(wallet)` per market; unstaked: NPM enumeration);
   then `slot0`, `positions(tokenId)`, `ownerOf`, `earned()` via
   `bankr.chain.multicall` on chain `base` (≤50 calls per batch,
   human-readable ABI strings). Claimable fees need the simulated
   `collect` with `"from"` (§2) — do those as raw `eth_call` POSTs via
   `http.fetch` to the §2 RPC list (`http.fetch` returns the parsed
   body directly). Value positions at POOL price (§2 math, labeled
   "pool price"); AERO at Coinbase spot via `http.fetch`. Merge basis
   from `appKV.get("record:basis:" + tokenId)`, compute `pnlUsd` per §9
   (loose balances included), then `appKV.set("positions_snapshot", …)`
   + `appKV.set("meta", …)` (merge an `automation` arg into meta when
   the caller passes one) and return the snapshot. Also upsert today's
   point `record:history:YYYY-MM-DD` = `{totalUsd, pnlUsd}` — a daily
   value series (same-day runs overwrite) the page can chart.
2. `recordEntry` — args `{market, tokenId, entryUsd, enteredAt}` →
   `appKV.set("record:basis:" + tokenId, args)`. Call it via
   `run_app_script` right after every mint; remove the record on exit.

Freshness: `set_app_schedule` → `refreshPositions` every 30 minutes
(`*/30 * * * *`). That cron is a direct script run — cheap, no LLM, and
it NEVER trades; the §8 manage pass owns decisions. The page also gets
a Refresh button invoking `refreshPositions`.

Page: one self-contained HTML document, inline CSS/JS, dark, no
external assets. Header: total value, "updated Xm ago" from
`meta.updatedAt`, Refresh button, and a one-line stale warning when the
snapshot is older than 2 hours. One card per position: market, value,
a big IN RANGE / OUT OF RANGE badge, band and current price in DOLLARS
(house rule: prices, never ticks), route as plain words ("earning
AERO" / "earning fees"), earnings, and P&L per §9 — labeled, never
annualized. A small value-over-time line from the history series makes
divergence loss visible instead of abstract. When `meta.automation`
shows under ~48 hours of runs left, show one warning strip: "manage
automation expires soon — say 'renew my LP automation'". Empty state:
"No LP positions yet — say 'LP $50 into AAPL'."

After creating: run `refreshPositions` once via `run_app_script` (so
the first open isn't blank), then give the user the app URL from the
tool result. (`dry_run_app_script` has no persistent KV — verify KV
wiring with a real `run_app_script`.)

## 14. What this skill refuses to do

- Enter a pool that fails ANY gate in §5 — including "the user is
  excited". Report the failing gate and the number it needs.
- Trade without a fresh real quote (entry/re-entry) — the NAV gate fails
  CLOSED.
- Promise or guarantee yields. The only projection allowed is the §10
  form, explicitly labeled "at this epoch's rate".
- Auto-sell without consent: compounding sells AERO only after the §12
  setup line was said and `compound: sell` recorded.
- Create an automation or an app unbidden: both are offered once and
  built only on the user's yes (§12, §13).
- Silence a failure: every skipped step, estimated basis, degraded input,
  or stopped sequence is reported to the user in plain language.
- Trade from the dashboard cron: `refreshPositions` reads and displays,
  never transacts. Only the §8 manage pass (or the user in chat) acts.