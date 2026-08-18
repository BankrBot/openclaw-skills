---
name: robinhood-chain-stock-tokens
description: Live prices, split-adjusted supply, DeFi depth and corporate actions for tokenized stocks on Robinhood Chain. Use when a request involves a stock ticker as an onchain token (NVDAon, AAPLon, TSLAon...), before sizing a trade in one, or when supply, market cap, splits or dividends for these tokens come up.
tags: [api, trading, stock-tokens, robinhood-chain, x402, mcp]
---

# Robinhood Chain stock tokens

REST over plain HTTP, base URL `https://www.hoodgrow.com`.

    curl -H "Authorization: Bearer $HOODGROW_API_KEY" \
      https://www.hoodgrow.com/api/agent/token/NVDA

Returns price, corporate-action adjusted supply, DeFi depth and pending
actions for one symbol. That one call answers most questions.

## Supply is not totalSupply — get this right

These tokens implement ERC-8056. A corporate action does not mint or burn.
It changes a `uiMultiplier` that scales the DISPLAYED supply while every
balance stays untouched.

So `totalSupply()` read off the contract is the wrong number after any
split or dividend, and market cap computed from it is wrong by the same
factor. Use the adjusted supply this API returns — it is the figure a
holder actually owns. Never compute supply or market cap for these tokens
from chain state directly.

## Before sizing a trade

Check for a pending corporate action. One is staged on-chain before it
takes effect, so a split can be visible and not yet applied:

    curl -H "Authorization: Bearer $HOODGROW_API_KEY" \
      "https://www.hoodgrow.com/api/corporate-actions?symbol=NVDA"

`pending` means staged on-chain and not applied. `recent` means already in
Robinhood's official ledger. A pending split means displayed price and
supply are about to move for reasons unrelated to the market.

## Which path to use

1. **The API key, always.** Free at hoodgrow.com/profile, set as
   `HOODGROW_API_KEY` in env vars. 40 units/day: a single-symbol call
   costs 1, the full catalog costs 10.
2. **x402 only when the key is missing or its budget is spent.** Do not
   pay for a call the key would have covered. See
   references/x402-fallback.md.

Without either, the endpoints still answer on a shared per-IP budget —
enough to try, not enough to rely on.

## More

- All endpoints and their parameters: references/endpoints.md
- Paying with x402: references/x402-fallback.md
