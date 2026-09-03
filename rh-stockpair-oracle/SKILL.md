---
name: rh-stockpair-oracle
description: Pricing and corporate-action data for Robinhood Chain (4663) pools where one side is a tokenized stock or ETF. Implied USD price, pool depth, price impact, Chainlink deviation, is-the-underlying-market-open, upcoming splits and dividends, RH gas estimates, and unsigned swap calldata. Use for Robinhood Chain, chain 4663, stock-paired pools, NVDA/AAPL/TSLA/SPY tokens, tokenized equity pricing, RH gas, ERC-8056 multiplier, corporate actions on-chain. Covers Uniswap v4 AND v3 — v3 carries roughly a third of stock-paired volume.
tags: [robinhood, chain-4663, uniswap, oracle, stocks, corporate-actions, gas, defi]
version: 1
---

# RH stock-pair oracle

Pricing for **Robinhood Chain (4663)** pools where one side is a tokenized
stock or ETF. Deterministic: no model sits in the data path, and every response
carries the facts behind it.

**Base URL:** `https://oracle.sb4s.xyz`
**Source:** `https://github.com/MeMikko/rh-stockpair-oracle`

**Pricing.** This is not a free service, and as of 2026-09-03 it is **billing**:
a priced route called without payment answers `402` with everything needed to
pay it. Every response still says what it cost:

```
x-oracle-price-usd: 0.02     what this route costs
x-oracle-charged-usd: 0.02   what it cost you on this call
x-oracle-pricing: paid       the current mode
```

Read those headers rather than assuming — the mode has changed once already and
`x-oracle-pricing` is the only thing that knows the current one. The price is
**$0.02 for every priced route** — one figure, because Bankr's gateway prices
an endpoint rather than a route, and a published split it does not honour would
be a price callers are not charged. `/health` and `/coverage` are free and stay
free. Prices cover upstream cost rather than earn margin — adoption is the
goal.

## Why this exists

On Robinhood Chain, launchpads pair new tokens against tokenized equities
instead of against ETH. That makes the quote asset something whose price moves
on a market with opening hours, splits and dividends. Nothing else published
reads those pools and says what a token is actually worth in dollars, or how
far a pool has drifted from the equity's oracle price while the underlying
market is shut.

## What is covered

Both Uniswap deployments, from each contract's creation block to the tip.
Pool counts measured 2026-09-03; volume is the rolling 24h window, refreshed
every six hours (`GET /volume` carries its own `measuredSecondsAgo`):

| | v4 | v3 |
|---|---|---|
| Pools indexed | 600,040 | 426,449 |
| Stock-paired | 51,876 | 1,888 |
| 24h volume | $286.8M | $160.5M |
| Share | 64% | **36%** |

The v3 half matters more than its pool count suggests. **Four of the five
largest stock-paired pools by 24h volume are v3**, and NVDA's busiest pool is
a v3 NVDA/USDG pool with 256,303 swaps in the measured window — ahead of all
9,942 v4 NVDA pools. An index that covers only v4 misses more than a third of
the subject, which is what every other RH data source does today.

Every count here drifts: `GET /health` reports the live ones.

Live figures, not a snapshot: `GET /volume` returns the current measurement
with the window it was taken over, including `measuredSecondsAgo` — volume is
a rolling 24h figure refreshed every 6h, so read that rather than deriving an
age from a block number.

## Endpoints

All reads. Nothing here signs, broadcasts, or holds your funds.

```
GET  /.well-known/agent.json     START HERE: endpoints, auth, payment, limits
GET  /health                     index freshness: cursors with lag in seconds
GET  /coverage                   which stock tokens have a Chainlink feed
GET  /price?symbol=TSLA          a stock's own USD price from its Chainlink feed
GET  /pools?symbol=NVDA          counts per protocol + the top pool ids to quote
GET  /volume                     24h stock-paired volume, and its measurement window
GET  /quote?pool=<id>&size=<n>   implied USD, depth, price impact, deviation, market hours
                                 <id> = v4 poolId OR v3 pool address
POST /prepare-swap               unsigned calldata, bounded min-out (v4 and v3)
GET  /gas                        chain 4663 gas, split into L2 and L1-data components
GET  /corporate-actions          upcoming splits/dividends joined to the affected pools
POST /ask                        free-text question, structured answer
```

### `GET /quote`

```bash
curl 'https://oracle.sb4s.xyz/quote?pool=0x30e5…dced&size=1000'
```

**Takes either protocol**: a v4 poolId (32 bytes) or a v3 pool address.
`protocol` in the response says which, and `impact.source` names the quoter
that produced the figure (`quoter` for v4, `quoter-v3` for v3, which also
reports `ticksCrossed`). This matters because v3 carries ~37% of stock-paired
volume and four of the five largest stock-paired pools are v3. Get an
identifier from `GET /pools?symbol=`.

Returns spot from the pool's own sqrt price, implied USD of the paired token,
price impact simulated on the on-chain quoter, the live LP fee (correct for
dynamic-fee v4 pools), deviation vs Chainlink, whether the underlying market
is open, and the next corporate action on the pricing asset.

**Read the labels.** The response says what is measured and what is estimated:

| Field | Status |
|---|---|
| `price.spot*`, `impact.*`, `pool.liveLpFee` | measured on-chain |
| `oracle.deviation` | measured, or `null` with an explicit `deviationReason` |
| `market.*` | computed from an exchange calendar, not a feed |
| `depth.token0/token1` | **estimate** — active-tick liquidity only |

`depth` is the one number that can mislead: a pool can report meaningful depth
and still fail to fill a small order. Trust `impact`, not `depth`.

### Deviation is often `null`, on purpose

194 canonical stock tokens exist on chain 4663; **35 have a Chainlink feed.**
For the other 159 a deviation is not merely absent, it is *unknowable*
on-chain. And deviation is only computable when the other side has its own USD
reference — a memecoin/NVDA pool tells you about the memecoin, not about NVDA.

So `/quote` returns `deviation: null` with a `deviationReason` rather than
inventing a number. `GET /coverage` publishes the split, and
`GET /price?symbol=` returns the stock's own oracle price where one exists —
or 404 with the reason where none does, rather than substituting a pool's
implied price, which is a price for the *other* token in that pool. Any consumer that
treats a missing deviation as zero is wrong.

### `POST /prepare-swap`

```bash
curl -X POST https://oracle.sb4s.xyz/prepare-swap \
  -H 'content-type: application/json' \
  -d '{"pool":"0x01c4…e7db","amountIn":"10000000000000000","zeroForOne":true,"slippageBps":50}'
```

Unsigned calldata for the UniversalRouter, plus the approvals an ERC-20 input
needs (token→Permit2, then Permit2→router). `minOut` comes from the on-chain
quoter and is then floored by slippage — never from spot price, because on
these pools the hook and the live dynamic fee both move the real output.

If the quoter cannot price the swap it returns **422 and no calldata**.
Handing back a transaction whose output cannot be bounded is the one failure
worth refusing outright.

**Both protocols, two different shapes.** A v4 pool gets UniversalRouter
calldata plus the Permit2 pair of approvals. A v3 pool gets a direct call to
the v3 router plus **one** plain ERC-20 approval, scoped to the swap rather
than unlimited — and it requires an explicit `recipient`, because v3 names the
recipient in the calldata instead of defaulting to the sender.

The response's `router` block says which v3 router the calldata was built for
and whether that was read off the chain or configured. It matters: `SwapRouter`
and `SwapRouter02` differ by one struct field, so the selectors differ, and
calldata for the wrong one is a function the contract does not have.
`swap.encoding` names exactly what was built.

**Single-hop only.** RH's UniversalRouter `execute` is standard
(`0x3593564c`) and single-hop `SWAP_EXACT_IN_SINGLE` reproduces a real on-chain
swap byte for byte. Multi-hop `ExactInputParams` carries one extra dynamic
field that upstream v4-periphery does not have; it was empty in all 14 live
samples decoded, so its type cannot be determined from the wire and multi-hop
stays unimplemented.

### `GET /gas`

Nothing else publishes gas for chain 4663. Values come from the Nitro
`ArbGasInfo` precompile; `?to=&data=` splits a specific call into L2 and
L1-data components via `NodeInterface.gasEstimateComponents` — plain
`eth_estimateGas` folds the two together and hides exactly the number that
changes when the launch subsidy lapses.

The subsidy flag is **measured across a window, not assumed from a date**. The
instantaneous L1 reading flaps: a non-zero observation during development
reverted to zero minutes later. `subsidy.evidence` exposes the sample count,
window length and last non-zero observation so a caller can judge for itself.

It also exposes `currentNonZeroRun` — the unbroken run of charged samples
ending at the newest one — with `currentNonZeroRunSeconds` and `zeroSince`.
Read those rather than the counts if you need to know whether the subsidy has
actually lapsed: `26` non-zero out of `107` means an ended subsidy if those 26
are the most recent 26 and a flapping reading if they are scattered, and only
the run distinguishes the two.

### `GET /corporate-actions`

```bash
curl 'https://oracle.sb4s.xyz/corporate-actions?withinDays=30&onlyAffecting=true'
```

The published calendar joined to the indexed pool set. Both halves are public;
nothing else joins them. On this chain a dividend or split applies through the
ERC-8056 `uiMultiplier`, so **every pool quoted in that stock reprices at
once** — NVDA's next dividend touches 10,394 indexed pools (9,942 v4 and 452
v3, measured 2026-09-03; `GET /pools?symbol=NVDA` for the live count).

Discovery comes from the published feed, not from chain events:
`UIMultiplierUpdated` only fires when the multiplier actually changes, which is
far too late to warn anyone.

### `POST /ask`

```bash
curl -X POST https://oracle.sb4s.xyz/ask \
  -H 'content-type: application/json' \
  -d '{"question":"how many pools quote NVDA?"}'
```

```json
{ "answered": true, "intent": "pools", "symbol": "NVDA",
  "answer": "9669 indexed pools on Robinhood Chain quote NVDA (9228 on Uniswap v4, 441 on v3).",
  "facts": { "symbol": "NVDA", "v4Pools": 9228, "v3Pools": 441, "totalPools": 9669 },
  "reproduce": "GET /pools?symbol=NVDA" }
```

`facts` and `reproduce` are the point: **verify the answer rather than trust
it.** Every `reproduce` names a *different* route that returns the same figure
independently — never the call you just made. No model runs in this path — intent is keyword matching over a closed
set — so it is deterministic and safe to call in a loop.

A question it cannot classify returns `answered: false` and says what it does
know. There is no fallback that guesses.

## Access and payment

**Start here: `GET /.well-known/agent.json`.** A machine-readable description
of every endpoint, the access methods, the payment details and the
limits. Also served from `GET /` when you send `Accept: application/json`, and
advertised in a `Link: rel="service-desc"` header on every response.

Five methods. Four are live; the fifth (`exact`) is offered only when this
deployment has a facilitator that will actually settle it, and `GET
/x402/supported` says whether it does right now rather than in principle.

| Method | For | How |
|---|---|---|
| **Bankr x402 gateway** | agents that already pay through Bankr | Call `https://x402.bankr.bot/0x4b19ee2a3de2521a3adc901989944c209c0a60ea/vates/<route>` instead of this origin. Bankr issues the 402 (x402 v2, `eip155:8453`), takes the USDC on Base, settles it and forwards the paid request here. Same routes under the same paths, same responses. **It charges $0.02 for `/health` and `/coverage` too** — those are free at this origin, so call `https://oracle.sb4s.xyz/health` and `/coverage` directly rather than through the gateway |
| **x402, scheme `exact`** | agents paying this origin directly | The published protocol, settled through a standard open facilitator — **offered only when one is configured that settles `exact` on this network**, which the origin asks rather than assumes. Check `GET /x402/supported` first: if `exactSettlement.advertised` is false it names why, and the gateway or prepaid credit is your route. When it is offered, call a priced route with no credential → `402` whose `accepts[0]` is `exact` on `base`. Sign the EIP-3009 authorization, retry with it base64-encoded in `x-payment`. `x402-fetch` does this for you; the facilitator pays the gas. What this deployment accepts: `GET /x402/supported` |
| **x402, prepaid credit** | callers that would rather transfer once than sign per call | Send USDC on Base to the treasury, then `POST /x402/topup {"txHash"}`. Any amount, no minimum; each call debits its own price. Balance: `GET /x402/balance?payer=0x…` |
| **wallet signature** | session-based | `GET /auth/nonce?address=0x…` returns the exact message to sign → `personal_sign` → `POST /auth/verify {address, signature, nonce}` → bearer token |
| **pro** | direct answers on Farcaster, unmetered | $5.99 USDC on Base for 30 days, `POST /pro/claim {txHash}`. Does not auto-renew. `POST /pro/link-fid {fid}` links a Farcaster account |

Billing is on, so a priced route needs one of these. `/health` and `/coverage`
need none and never will. `x-oracle-pricing` tells you the mode you are in on
every response — read it rather than assuming, including assuming this
paragraph is still current.

## Agent guidance

- **Never treat `deviation: null` as zero.** Check `deviationReason`. Most
  stock tokens have no feed, and that is a fact about the chain, not an error.
- **Quote before you size.** `depth` is an active-tick estimate; `impact` is a
  simulation. Only `impact` tells you whether a trade fills.
- **Check `market.isOpen` before acting on a deviation.** Stock tokens trade
  24/5 on-chain while the underlying market has hours; a wide spread at 03:00
  ET is the normal state of the world, not a signal.
- **Check `/corporate-actions` before quoting a size in a stock-paired pool.**
  A multiplier change reprices every pool in that stock simultaneously.
- **`/prepare-swap` returns calldata, never a transaction.** Submit it through
  Bankr with `chainId: 4663` after your own validation. A 422 means the swap
  could not be bounded — do not construct calldata yourself to work around it.
- **Do not hardcode a price.** Read `x-oracle-price-usd` and
  `x-oracle-charged-usd` per response. Launch mode already ended once; the
  headers are the only current answer.
- **Do not compare these volume figures to another dashboard's.** Denominators
  differ; see the repository README for the measured breakdown and the
  unreconciled residual against Bankr's published number.

## Limits

- `depth` is active-tick only, and is labelled as an estimate.
- Multi-hop `/prepare-swap` is unimplemented (see above).
- Volume figures are measured over a rolling 24h window and are refreshed
  every 6 hours, not live.
- 159 of 194 stock tokens have no Chainlink feed; for those, no deviation is
  computable by anyone.
