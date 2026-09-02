# rh-stockpair-oracle

Pricing and corporate-action data for **Robinhood Chain (4663)** pools where
one side is a tokenized stock or ETF.

Read-only. Nothing here signs, broadcasts, or holds funds. On Farcaster it
answers as [@vates](https://farcaster.xyz/vates).

Currently in **launch mode** — served without charge and no key required —
but this is not a free service. Every response publishes what the call will
cost once billing is enabled (`x-oracle-price-usd`), what it cost you today
(`x-oracle-charged-usd`), and the current mode (`x-oracle-pricing`). Read the
headers rather than assuming.

```bash
curl -s 'https://oracle.sb4s.xyz/quote?pool=0xPOOL_ID&size=1000'
curl -s 'https://oracle.sb4s.xyz/corporate-actions?withinDays=30'
curl -s -X POST https://oracle.sb4s.xyz/ask \
  -H 'content-type: application/json' \
  -d '{"question":"when is the next NVDA dividend?"}'
```

## What it does that nothing else does

- **Implied USD price** of the token paired against a tokenized equity, with
  pool depth and quoter-simulated price impact.
- **Chainlink deviation** where it is computable — and an explicit reason where
  it is not. 159 of 194 stock tokens have no feed; that is published rather
  than papered over.
- **Is the underlying market open.** Stock tokens trade 24/5 on-chain while the
  equity market has hours, so a wide spread at 03:00 ET is normal, not a signal.
- **Corporate actions joined to pools.** A dividend applies through the ERC-8056
  `uiMultiplier`, repricing every pool quoted in that stock at once — NVDA's
  next one touches 9,669 indexed pools.
- **Gas for chain 4663**, split into L2 and L1-data components, with the launch
  subsidy measured across a window rather than assumed from a date.
- **Uniswap v3 as well as v4.** v3 carries ~37% of stock-paired volume and
  three of the five largest pools. Every other RH source covers v4 alone.

See [SKILL.md](SKILL.md) for the full surface, the measured-vs-estimated
labels, and the agent guidance.
