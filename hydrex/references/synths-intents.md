# Intents

Auction-based cross-chain swaps between USDC on Base and Solana SPL tokens (or their Base-side synth representation). The router returns a ready-to-sign Base transaction plus the quote in a single call.

**Router base URL:** `https://router.api.hydrex.fi`

**On-chain settlement contracts (Base mainnet):**

| Contract | Address |
|---|---|
| Hydrex Intent Router | `0xBa29b52084E1f363D830E5e8c9370046D76eF62A` |
| Hydrex Bridge | `0x06F57053638546A0E6cc94A6986bf61F35524278` |
| Wrapper Factory | `0x60f912c8b696eab5693058402002b7369e272117` |

The router API's response `transaction.to` will normally equal the **Hydrex Intent Router** address above. Use that as the spender when checking/setting ERC-20 allowance on USDC or on the synth being sold — and treat a `transaction.to` that doesn't match as a signal to abort (don't sign anything pointing at an unrecognized address).

## The Input Rule

**The `inputToken` of an auction intent must be either USDC (Base) or a registered Hydrex synth.** No exceptions.

- `direction = "buy"` → `inputToken` is `USDC` (literal or `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`), `targetToken` is a Solana mint
- `direction = "sell"` → `inputToken` is a Solana mint, `targetToken` is `USDC`, and `wrappedInputToken` is the Base synth ERC-20 address the contract debits

If a user wants to spend anything else (ETH, WETH, cbBTC, random tokens), refuse to build an intent and tell them to swap to USDC first.

## Endpoints

| Operation | Method + Path |
|---|---|
| Create buy intent | `GET /multichain-auction/intent/buy` |
| Create sell intent | `GET /multichain-auction/intent/sell` |
| Poll status after submit | `GET /multichain-auction/status?transactionHash=<base tx hash>` |
| Cancel a pending intent | `GET /multichain-auction/intent/cancel` |

## Request Query Parameters

### Common (both directions)

| Param | Required | Notes |
|---|---|---|
| `quoteChainId` | yes | Always `solana` for auction routes |
| `amount` | yes | Raw units. USDC=6 decimals on buy; synth/mint decimals on sell |
| `recipient` | recommended | User's Base address (settlement recipient) |
| `slippage` | optional | BPS. Default `50` (0.5%) is sensible |
| `auctionSeconds` | optional | Auction window in seconds. Default `20` |
| `referral` | optional | Referrer address |
| `referralFeeBps` | optional | Referral fee in BPS |
| `origin` | optional | Free-form origin tag |
| `admin` | optional | Fee recipient address |
| `spread` | optional | Aggregator spread BPS |
| `spreadDirection` | optional | `input` or `output` |
| `reflectToken` | optional | Boolean; default `false` |

### `direction=buy` — USDC → Solana asset

| Param | Required | Notes |
|---|---|---|
| `direction` | yes | `buy` |
| `inputToken` | yes | `USDC` (literal) or `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
| `targetToken` | yes | Solana SPL mint, base58 |
| `wrappedOutputToken` | optional | Base synth ERC-20. Set this if you want the synth to land on Base instead of (or alongside) the SPL transfer flow |

### `direction=sell` — Solana asset → USDC

| Param | Required | Notes |
|---|---|---|
| `direction` | yes | `sell` |
| `inputToken` | yes | Solana SPL mint, base58 |
| `targetToken` | yes | `USDC` (literal) or `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
| `wrappedInputToken` | **required when settling from a Base synth balance** | Base synth ERC-20 address from the validator registry |

## Response Shape

```json
{
  "responseTimeMs": 412,
  "quoteChainId": "solana",
  "targetChainId": "solana",
  "router": "hydrex-multichain-auction",
  "transaction": {
    "to":   "0x...",            // Base contract to call (sign this)
    "data": "0x...",            // ABI-encoded calldata
    "value": "0"                // ETH value (almost always "0")
  },
  "intentParams": {
    "spendAsset": "0x...",
    "spendDecimals": 6,
    "quoteSpendTokenAddress": "...",
    "targetTokenAddress": "...",
    "inputToken": "0x...",      // the token the user must approve
    "inputAmount": "100000000",
    "outputToken": "...",
    "desiredOutput": "...",
    "minOutput":   "...",       // slippage-protected floor that lands in recipient
    "auctionSeconds": 20,
    "recipient": "0x..."
  },
  "quote": {
    "amountIn":  "100000000",
    "amountOut": "9876543210",
    "minOutputAmount": "9876543210",
    "source": "venue-name",
    "responseTime": 250,
    "totalResponseTime": 380
  }
}
```

**Display to user before signing:**

- Input: `quote.amountIn / 10^inputDecimals` of input symbol
- Output (expected): `quote.amountOut / 10^outputDecimals` of output symbol
- Output (min after slippage): `intentParams.minOutput / 10^outputDecimals`

## Examples

### Buy WIF with 100 USDC

```bash
curl -s "https://router.api.hydrex.fi/multichain-auction/intent/buy?\
quoteChainId=solana&\
direction=buy&\
inputToken=USDC&\
targetToken=EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm&\
amount=100000000&\
recipient=0xUserAddress&\
slippage=50&\
auctionSeconds=20"
```

(WIF mint: `EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm`)

### Sell 25 WIF synth into USDC

```bash
curl -s "https://router.api.hydrex.fi/multichain-auction/intent/sell?\
quoteChainId=solana&\
direction=sell&\
inputToken=EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm&\
targetToken=USDC&\
wrappedInputToken=0xBaseSynthAddressFromValidator&\
amount=25000000&\
recipient=0xUserAddress&\
slippage=50&\
auctionSeconds=20"
```

## Execution (Bankr)

The spender for approval is `response.transaction.to`, which should equal the **Hydrex Intent Router** at `0xBa29b52084E1f363D830E5e8c9370046D76eF62A`. Verify before approving — if they don't match, abort.

```
# direction=buy (input is USDC)
1. Verify response.transaction.to == 0xBa29b52084E1f363D830E5e8c9370046D76eF62A
2. Check ERC-20 allowance: allowance(user, response.transaction.to) on USDC
3. If allowance < amount: approve(response.transaction.to, amount) on USDC
4. Send response.transaction (to/data/value) to Base from the user's wallet

# direction=sell with wrappedInputToken (input is a Base synth)
1. Verify response.transaction.to == 0xBa29b52084E1f363D830E5e8c9370046D76eF62A
2. Check allowance(user, response.transaction.to) on the synth ERC-20
3. If allowance < amount: approve(response.transaction.to, amount) on the synth
4. Send response.transaction to Base
```

**Natural language to Bankr:**

```bash
bankr agent "Buy 100 USDC of WIF on Hydrex"
bankr agent "Sell my 25 WIF synth into USDC on Hydrex"
```

## Status Polling

```bash
curl -s "https://router.api.hydrex.fi/multichain-auction/status?transactionHash=0xYourBaseTxHash"
```

Returns `{ rows: [{ status, ... }, ...] }`.

| Status | Meaning |
|---|---|
| `pending` | Auction running or fill in flight — keep polling |
| `filled` / `completed` | **Terminal success** |
| `cancelled` / `canceled` / `failed` | **Terminal failure** |
| `expired` | **Not terminal** post-submit. Auction window closed but a late Solana fill may still land. Continue polling for ~2 min before giving up. |

Recommended cadence: poll every 1s, cap at ~120 attempts (~2 min).

## Cancel

```bash
curl -s "https://router.api.hydrex.fi/multichain-auction/intent/cancel?transactionHash=0x..."
```

Only useful while the intent is `pending` and the on-chain settlement hasn't been broadcast yet.

## Decimal Gotcha

The router returns amounts in different decimal systems depending on direction:

| Field | `direction=buy` | `direction=sell` |
|---|---|---|
| `inputAmount` (EVM approval) | USDC (6) | synth decimals |
| `quote.amountIn` | USDC (6) | Solana mint decimals |
| `quote.amountOut` | Solana mint decimals | USDC (6) |

When in doubt, fetch the synth's `decimals` from the validator `/tokens` response and the Solana mint's decimals from the same row.

## Related references

- [synths.md](synths.md) — validator `/tokens` registry and on-chain balance reads
- [synths-multichain-router.md](synths-multichain-router.md) — quote semantics and decimals

## Where this lives in send-app

For cross-reference if you need to verify behavior against the production frontend:

- `src/state/auctionRouter/queries.ts` — URL construction and request
- `src/state/auctionRouter/hooks.ts` — direction inference, USDC-literal trick, `wrappedInputToken` wiring
- `src/state/auctionRouter/mutations.ts` — approve + intent transaction batching
- `src/state/auctionRouter/types.ts` — full response types
- `src/modules/trading/tradeActions/core/useSpendOptions.ts` — enforces "USDC only" on the input side when an auction is enabled
