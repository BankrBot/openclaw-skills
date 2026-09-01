---
name: hyperd
description: Pre-trade DeFi intelligence for AI agents on Base — wallet risk (Chainalysis Sanctions + GoPlus), token security (GoPlus 0–100 score, honeypot detection), liquidation risk (composite health factor across Aave V3 / Compound v3 / Spark / Morpho), portfolio P&L (realized + unrealized, per-token), DEX quote aggregator (Paraswap + 0x), governance LLM summaries (Snapshot + Tally analyzed by Claude / GPT-4o-mini), wallet anomaly detection, contract audit composite, Farcaster sentiment, multi-protocol TVL, gas markets, and a multi-call bundle endpoint. 20 paid endpoints. Pay $0.005–$0.20 per call in USDC on Base via x402 — no API key, no signup, the signed payment is the auth. Triggers on mentions of liquidation risk, health factor, sanctions check, OFAC, wallet risk, token security, honeypot, P&L, swap quote, best price, governance proposal, contract audit, gas estimate, hyperD, or x402.
---

# hyperD: Pre-Trade DeFi Intelligence for AI Agents

hyperD is the **decision layer** for agents that need to know things before they act. While Bankr executes trades, hyperD answers the questions agents need answered before pulling the trigger:

- "Is this address safe to interact with?"
- "Is this token a scam?"
- "Am I about to get liquidated?"
- "What's my P&L?"
- "What's the best price for this swap right now?"

Twenty paid endpoints, all on Base, all settled in USDC via the x402 protocol. No API key. No signup. No rate-limit form. The signed EIP-3009 USDC transfer authorization is the auth — settles in ~2 seconds via Coinbase's facilitator.

## Decide → Execute pattern

hyperD pairs naturally with Bankr's execution layer:

```
hyperD (Decide)              Bankr (Execute)
───────────────────         ─────────────────
Wallet risk check       →    Cancel send-to / proceed
Token security scan     →    Buy / skip
Liquidation health      →    Add collateral / unwind
P&L tracking            →    Take profit / hold
DEX quote               →    Submit swap
Governance summary      →    Vote yes/no
Contract audit          →    Interact / avoid
```

## Pricing — agent decision cycle for $0.32

Calling all five marquee endpoints costs less than a third of a cent:

| Endpoint | Cost | Question answered |
|---|---|---|
| `GET /api/risk/wallet` | $0.10 | Is this address sanctioned or risky? |
| `GET /api/token/security` | $0.05 | Is this token a scam? |
| `GET /api/liquidation/risk` | $0.10 | Am I about to get liquidated? |
| `GET /api/wallet/pnl` | $0.05 | Am I up? |
| `GET /api/dex/quote` | $0.02 | What's the best swap price? |
| **Total** | **$0.32** | Full agent decision cycle |

Plus 15 more endpoints for $0.005–$0.20 each. See "Full Endpoint Catalog" below.

## Quick start — no setup, just call

The agent needs an EVM wallet on Base holding USDC. $5 is plenty for hundreds of decision cycles. Then:

```bash
# 1. Make a normal GET — no auth header
curl -i "https://api.hyperd.ai/api/risk/wallet?address=0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045"

# 2. Server responds HTTP 402 with payment-required header
# (the agent's x402 client signs an EIP-3009 USDC authorization)

# 3. Retry with X-Payment header
# (Coinbase facilitator settles in ~2 seconds)

# 4. Server returns the data
```

Reference x402 clients: `@x402/fetch` (TypeScript), Python implementation in [`hyperd-mcp/examples/python`](https://github.com/hyperd-ai/hyperd-mcp/tree/main/examples/python).

For ElizaOS agents: `npm install @hyperd-ai/plugin-hyperd` exposes the five marquee endpoints as actions.

For MCP-aware clients (Claude Desktop, Cursor, Cline, Zed): `npx -y hyperd-mcp` adds 23 tools.

## Marquee endpoints

### GET /api/risk/wallet — Wallet Risk Check

Chainalysis Sanctions Oracle + GoPlus heuristics. **$0.10 USDC.**

```bash
curl -i "https://api.hyperd.ai/api/risk/wallet?address=0x..."
```

Returns:
```json
{
  "address": "0x...",
  "sanctioned": false,
  "risk_tier": "low",
  "categories": [],
  "sources": { "chainalysis": "ok", "goplus": "ok" },
  "generated_at": "2026-05-11T17:45:00Z"
}
```

When `sanctioned: true`, the wallet is on OFAC SDN list. Refuse interaction. When `risk_tier: high`, the wallet has been tagged in categories like `mixer`, `ransomware`, `darknet`, or `phishing`.

### GET /api/token/security — Token Security Scan

GoPlus security score 0–100. Honeypot detection, owner permissions, taxes, holder concentration. **$0.05 USDC.**

```bash
curl -i "https://api.hyperd.ai/api/token/security?contract=0x...&chain=base"
```

Returns:
```json
{
  "contract": "0x...",
  "chain": "base",
  "security_score": 88,
  "honeypot": false,
  "owner_can_mint": false,
  "owner_can_blacklist": false,
  "buy_tax_pct": 0,
  "sell_tax_pct": 0,
  "holder_concentration_top10_pct": 42,
  "notes": []
}
```

Score > 80 generally safe. Score < 50 high-risk. Always check `honeypot` and `owner_can_blacklist` regardless of score.

### GET /api/liquidation/risk — Cross-Protocol Liquidation Risk

Composite health factor across **Aave V3, Compound v3, Spark, and Morpho**. No other API combines all four. **$0.10 USDC.**

```bash
curl -i "https://api.hyperd.ai/api/liquidation/risk?address=0x...&chain=base"
```

Returns:
```json
{
  "address": "0x...",
  "chain": "base",
  "composite_health_factor": 1.42,
  "liquidation_imminent": false,
  "positions": [
    { "protocol": "aave-v3", "health_factor": 1.42, "collateral_usd": 50000, "debt_usd": 30000 },
    { "protocol": "morpho", "health_factor": 2.81, "collateral_usd": 12000, "debt_usd": 4000 }
  ],
  "recommended_add_collateral_usd": 2500
}
```

Pass `?chain=all` to fan out across the 7 supported EVM chains.

When `liquidation_imminent: true`, health factor is below 1.05 — execute add-collateral or unwind immediately.

### GET /api/wallet/pnl — Wallet P&L

Realized + unrealized P&L. FIFO accounting. Per-token breakdown with cost basis. **$0.05 USDC.**

```bash
curl -i "https://api.hyperd.ai/api/wallet/pnl?address=0x...&chain=base"
```

Returns:
```json
{
  "address": "0x...",
  "chain": "base",
  "window": "all-time",
  "realized_pnl_usd": 12400,
  "unrealized_pnl_usd": 3200,
  "total_pnl_usd": 15600,
  "per_token": [
    { "symbol": "WETH", "realized_pnl_usd": 8200, "unrealized_pnl_usd": 1500, "cost_basis_usd": 25000, "market_value_usd": 26500 }
  ]
}
```

### GET /api/dex/quote — Best Swap Route Aggregator

Best route across **Paraswap + 0x**. Returns highest output, gas estimate, slippage. **$0.02 USDC.**

```bash
curl -i "https://api.hyperd.ai/api/dex/quote?from=USDC&to=WETH&amount=100&chain=base"
```

Returns:
```json
{
  "from": "USDC",
  "to": "WETH",
  "amount_in": "100",
  "chain": "base",
  "best": { "source": "paraswap", "amount_out": "0.0312", "gas_estimate": "180000", "slippage_pct": 0.05 },
  "alternatives": [
    { "source": "0x", "amount_out": "0.0311", "gas_estimate": "175000" }
  ]
}
```

Hand the `best` route to Bankr's swap execution.

## Full endpoint catalog (20 paid + 4 free)

### Marquee (above)
- `GET /api/risk/wallet` ($0.10)
- `GET /api/token/security` ($0.05)
- `GET /api/liquidation/risk` ($0.10)
- `GET /api/wallet/pnl` ($0.05)
- `GET /api/dex/quote` ($0.02)

### Secondary data
- `GET /api/balance` ($0.01) — Multi-chain ERC-20 + native balance across Base, Ethereum, Polygon, Arbitrum, Optimism, Avalanche, BNB. `?chain=all` fans out in parallel.
- `GET /api/yield` ($0.05) — DefiLlama universe filtered by risk tier, TVL floor, IL exposure, ranked by APY.
- `GET /api/token/info` ($0.01) — CoinGecko + DefiLlama aggregated metadata.
- `GET /api/protocol/tvl` ($0.01) — DefiLlama TVL + audit history + chain distribution.
- `GET /api/gas/estimate` ($0.005) — Gas price + base fee + tip percentiles for fast/standard/slow.

### Intelligence
- `GET /api/wallet/persona` ($0.10) — Behavioural classification: Trader / HODLer / MEV bot / Whale / Smart-Money / Airdrop-Farmer / Compromised / Inactive.
- `GET /api/contract/audit` ($0.10) — Composite: GoPlus + Sourcify + DefiLlama + on-chain heuristics → 0–100 risk score.
- `GET /api/governance/summarize` ($0.10) — Snapshot or Tally proposal analyzed by Claude Sonnet / GPT-4o-mini. Who benefits, who pays, recommended position.
- `GET /api/sentiment/token` ($0.05) — Farcaster sentiment 0–100 + volume + trend + sample casts.
- `GET /api/wallet/anomaly` ($0.10) — Behavioural deviation vs the wallet's own 180-day baseline. Catches compromised hot wallets + suddenly-active dormants.

### Operations
- `GET /api/budget/guardian` ($0.01) — Agent USDC spend visibility + optional cap check. Call this *before* the next paid call.
- `POST /api/bundle` ($0.20 fixed) — Combine 1–10 paid GETs into a single x402 settlement. Saves up to 33% vs à la carte + 9 round-trips. Use for composite analyses.

### Subscription tier (webhook alerts)
- `POST /api/watch/create` ($3 / 30-day) — Webhook fires on liquidation-risk threshold crossings. HMAC-signed payloads.
- `GET /api/watch/list` ($0.001)
- `DELETE /api/watch/cancel` ($0.001)

### Free
- `GET /api/health` — liveness + version
- `GET /api/discover` — Bazaar-format network catalog
- `GET /api/catalog` — full machine-readable catalog
- `GET /api/pricing` — machine-readable price list

## When NOT to use hyperD

- **Raw RPC calls** → use [alchemy](../alchemy/) or [quicknode](../quicknode/).
- **Single-chain wallet portfolio with USD values** → use [zerion](../zerion/) (cheaper at $0.01/call for that specific need).
- **NFT-specific data** → use [opensea](../opensea/) or [zerion](../zerion/).
- **Forensic deep-dive on a suspected scam token** → use [bankr-token-scam-analysis](../bankr-token-scam-analysis/) (single-token forensic) plus hyperD's `token/security` for the GoPlus composite.

hyperD is the right tool when you need **decision-grade data** to gate an action — liquidation risk, sanctions, P&L, route price — and you want pay-per-call economics without a sales call or rate-limit form.

## Links

- **Production API**: [api.hyperd.ai](https://api.hyperd.ai)
- **Discover (Bazaar)**: [api.hyperd.ai/api/discover](https://api.hyperd.ai/api/discover)
- **Catalog (full)**: [api.hyperd.ai/api/catalog](https://api.hyperd.ai/api/catalog)
- **MCP server**: `npx -y hyperd-mcp` ([npm](https://www.npmjs.com/package/hyperd-mcp), [Smithery](https://smithery.ai/servers/hyperd/hyperd-mcp))
- **ElizaOS plugin**: `npm install @hyperd-ai/plugin-hyperd` ([npm](https://www.npmjs.com/package/@hyperd-ai/plugin-hyperd), [GitHub](https://github.com/hyperd-ai/plugin-hyperd))
- **Mirror repo (MIT)**: [github.com/hyperd-ai/hyperd-mcp](https://github.com/hyperd-ai/hyperd-mcp)
- **x402 protocol**: [x402.org](https://x402.org)
