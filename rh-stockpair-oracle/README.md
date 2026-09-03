# RH stock-pair oracle

Pricing and corporate-action data for **Robinhood Chain (4663)** pools where
one side is a tokenized stock or ETF — NVDA, AAPL, TSLA, SPY and 190 others.

**Base URL:** `https://oracle.sb4s.xyz`
**Source:** https://github.com/MeMikko/rh-stockpair-oracle

**Billing since 2026-09-03.** A priced route called without payment answers
`402` carrying everything needed to pay it. `$0.02` per priced call, one figure
for every priced route; `/health` and `/coverage` are free and stay free. Every
response says what it cost:

```
x-oracle-price-usd: 0.02     what this route costs
x-oracle-charged-usd: 0.02   what it cost you on this call
x-oracle-pricing: paid       the current mode
```

Read those headers rather than hardcoding a price. This has never been
advertised as a free service, and the mode has already changed once.

## Paying

- **Through Bankr** — call
  `https://x402.bankr.bot/0x4b19ee2a3de2521a3adc901989944c209c0a60ea/vates/<route>`
  instead of the origin. Same routes under the same paths, same responses;
  Bankr issues the 402, settles the USDC on Base and forwards the paid
  request. **It prices its whole path space**, so `/health` and `/coverage`
  cost $0.02 there — call those at the origin, where they are free.
- **Prepaid credit** — one USDC transfer on Base, then `POST /x402/topup`.
  Any amount, no minimum; each call debits its own price.
- **Scheme `exact`** — the published x402 protocol, offered only when this
  deployment has a facilitator that will actually settle it. `GET
  /x402/supported` says whether it does right now and names the reason when it
  does not. Check it before signing anything.

## What it answers

- **What a stock-paired token is worth in dollars.** `GET /quote?pool=&size=`
  returns the implied USD price, pool depth, a quoter-simulated price impact
  for your size, deviation against the stock's Chainlink feed, and whether the
  underlying equity market is open. Takes a Uniswap **v4 poolId or a v3 pool
  address** — `protocol` in the response says which.
- **Which pools to quote.** `GET /pools?symbol=NVDA` returns counts split by
  protocol plus the top pool identifiers, ordered by measured 24h swaps.
  `swaps24h: null` means never measured, not measured at zero.
- **What is about to reprice everything.** `GET /corporate-actions` joins the
  published calendar to the indexed pool set. An ERC-8056 multiplier change
  reprices every pool in that stock at once — NVDA's next one touches 10,394
  indexed pools (measured 2026-09-03).
- **Unsigned swap calldata.** `POST /prepare-swap` returns router address,
  min-out from the quoter and ready-to-sign calldata. Single-hop only. v4 goes
  through UniversalRouter + Permit2; v3 through the v3 router with one plain
  ERC-20 approval scoped to the swap rather than unlimited. Which v3 router is
  deployed is **read off the chain**, never assumed — the two variants'
  structs differ, so their selectors differ, and half-correct calldata is worse
  than none. It never signs and never broadcasts.
- **Gas for chain 4663.** `GET /gas`, split into L2 and L1-data components,
  with the launch subsidy reported as an unbroken run of measured samples
  rather than assumed from a date.
- **Free text.** `POST /ask` returns a structured answer with the facts behind
  it and a call that reproduces it. No model in the data path.

## Uniswap v3 as well as v4

v3 carries **~36% of stock-paired volume**, and four of the five largest
stock-paired pools by 24h volume are v3. NVDA's busiest pool is a v3 pool with
256,303 swaps in the measured window — ahead of all 9,942 v4 NVDA pools. Any
claim of full coverage that indexes v4 alone is false, which is what every
other RH data source does today.

## Reading the answers honestly

- **`deviation: null` is never zero.** 159 of the 194 stock tokens have no
  Chainlink feed, so a deviation is unknowable rather than absent. Read
  `deviationReason`.
- **`depth` is an active-tick estimate and can mislead.** Size on `impact`,
  which is a quoter simulation.
- **`market.isOpen` before acting on a deviation.** Stock tokens trade 24/5
  on-chain while the underlying market has hours; a wide spread at 03:00 ET is
  the normal state of the world, not a signal.
- **A 422 from `/prepare-swap`** means the swap could not be bounded. Do not
  hand-roll calldata around it.
- **Do not compare these volume figures to another dashboard's.** Denominators
  differ; the repository README carries the measured breakdown and the residual
  that did not reconcile.
