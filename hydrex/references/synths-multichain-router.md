# Multichain Router

The Hydrex multichain router prices and routes USDC ↔ Solana-asset trades through an auction. For this skill, **the only router endpoint that matters is the auction intent endpoint** — it returns both the quote and the ready-to-sign transaction in a single call.

**Base URL:** `https://router.api.hydrex.fi`

## There Is No Separate "Quote" Endpoint for Auctions

Hitting `/multichain-auction/intent/{buy|sell}` already gives you `quote` plus `transaction`. You don't (and can't) get an auction quote without also building the intent. This is intentional — the auction window starts when the intent is built, and the quoted amount is tied to that window.

If a user just wants a price preview, build the intent and **don't submit the transaction**. Show them `quote.amountOut` and `intentParams.minOutput`, and let them confirm before signing.

(For same-chain swaps with no auction, the router has `GET /quote`. That path is out of scope for this skill — this skill is exclusively USDC ↔ synth cross-chain.)

## Quote Semantics

From the intent response:

```json
"quote": {
  "amountIn":  "100000000",
  "amountOut": "9876543210",
  "minOutputAmount": "9876543210",
  "source": "venue-name",
  "responseTime": 250,
  "totalResponseTime": 380
}
```

| Field | Meaning |
|---|---|
| `amountIn` | What goes in, raw units in the **venue's** decimal system |
| `amountOut` | What's expected out, raw units in the **venue's** decimal system |
| `minOutputAmount` | Floor the venue commits to (auction-side) |
| `source` | Which venue / market-maker won the auction |
| `responseTime` / `totalResponseTime` | Diagnostic timings (ms) |

The user-visible floor that actually lands in `recipient` is `intentParams.minOutput` (slippage-adjusted, in the **chain-side** decimal system). Always show that, not `quote.minOutputAmount`, when telling the user "you'll receive at least X".

## Decimals Are Direction-Dependent

| Field | `direction=buy` | `direction=sell` |
|---|---|---|
| `intentParams.inputAmount` (EVM approval) | USDC = 6 | synth decimals |
| `intentParams.minOutput` (lands in recipient) | mint decimals | USDC = 6 |
| `quote.amountIn` | USDC = 6 | mint decimals |
| `quote.amountOut` | mint decimals | USDC = 6 |

Always pull `decimals` from the validator `/tokens` row before formatting.

## Slippage

`slippage` is in basis points on the query string. Common values:

| BPS | % | When to use |
|---|---|---|
| `25` | 0.25% | Tight; major pairs with deep books |
| `50` | 0.5% | **Default** |
| `100` | 1% | Volatile mints |
| `300` | 3% | Tiny caps or known low liquidity |

If a quote keeps reverting on-chain, the most common fix is bumping slippage.

## Auction Window

`auctionSeconds` (default `20`) controls how long market-makers have to bid. Longer windows can produce better prices on illiquid pairs at the cost of latency. Shorter windows are snappier on highly liquid pairs.

Don't go below `10` or above `60` without a specific reason.

## Fee Fields (optional)

The frontend wires these through, mostly for the Send referral program. For a plain skill invocation you can omit all of them.

| Param | Purpose |
|---|---|
| `referral` | Address that earns referral fees |
| `referralFeeBps` | Referral fee in BPS |
| `admin` | Fee recipient address |
| `spread` | Aggregator spread in BPS |
| `spreadDirection` | `input` or `output` — which side the spread is taken from |
| `origin` | Free-form origin tag for analytics |
| `reflectToken` | Boolean; default `false` (Send-specific flag) |

## Same-Chain `/quote` (out of scope — for reference only)

If you need a regular Base ↔ Base swap (e.g. to get the user from ETH or cbBTC into USDC so they can then bridge), use:

```
GET https://router.api.hydrex.fi/quote
  ?chainId=8453
  &fromTokenAddress=0x...
  &toTokenAddress=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
  &amount=<raw>
  &taker=<user address>
  &slippage=50
```

But this is a separate flow — don't try to chain it into an intent automatically. Tell the user they need to swap first, then create the intent.
