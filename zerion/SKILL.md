---
name: zerion
description: Interpreted crypto wallet data for AI agents. Use when an agent needs portfolio values, token positions, DeFi positions, transaction history, or PnL data across 41+ chains. Zerion transforms raw blockchain data into agent-ready JSON with USD values, protocol labels, and enriched metadata. Supports x402 pay-per-request ($0.01 USDC on Base) and API key access. Triggers on mentions of portfolio, wallet analysis, positions, transactions, PnL, profit/loss, DeFi, token balances, or Zerion.
---

# Zerion: Wallet Intelligence for AI Agents

Zerion provides interpreted, enriched crypto wallet data across 41+ chains including Ethereum, Base, Arbitrum, Optimism, Polygon, Solana, and more.

Unlike raw RPC data, Zerion returns:
- **USD values** for all positions
- **Protocol labels** (Uniswap, Aave, etc.)
- **Human-readable transaction types** (swap, stake, bridge)
- **PnL calculations** (realized, unrealized, per-asset)
- **DeFi position breakdowns** (deposits, borrows, LP positions)

Two ways to access:

- **x402 (no account needed)**: Pay $0.01 USDC per request on Base. No API key, no signup.
- **API key**: Get a free key instantly at [dashboard.zerion.io](https://dashboard.zerion.io) for higher rate limits.

## Research → Execute Pattern

Zerion is the **research layer**. Use it to analyze wallets, find opportunities, track PnL. Then hand off to Bankr for **execution** (swaps, stop-losses, DCA).

```
Zerion (Research)          Bankr (Execute)
─────────────────         ────────────────
Portfolio analysis   →    Rebalance trades
PnL tracking         →    Stop-loss orders
Position monitoring  →    Take-profit orders
Whale watching       →    Copy trades
```

## CLI Quick Start

```bash
npm install -g zerion-cli

# Set API key
export ZERION_API_KEY="zk_..."

# Or use x402 (no key needed)
zerion-cli wallet portfolio 0x... --x402

# Commands
zerion-cli wallet portfolio <address>      # Total USD value
zerion-cli wallet positions <address>      # All token positions
zerion-cli wallet transactions <address>   # Transaction history
zerion-cli wallet pnl <address>            # Profit & loss
zerion-cli wallet analyze <address>        # Full analysis
zerion-cli chains list                     # Supported chains
```

## Core Endpoints

### Portfolio Value

Get aggregated USD value across all chains:

```
GET /v1/wallets/{address}/portfolio
```

```json
{
  "data": {
    "attributes": {
      "total": { "positions": 44469.60 },
      "positions_distribution_by_chain": {
        "base": 27495.06,
        "ethereum": 6216.25,
        "arbitrum": 1234.56
      },
      "changes": {
        "absolute_1d": 305.86,
        "percent_1d": 0.69
      }
    }
  }
}
```

### Positions

Get all token and DeFi positions with metadata:

```
GET /v1/wallets/{address}/positions
```

Query params:
- `filter[positions]`: `only_simple` (tokens only), `only_defi`, `no_filter` (all)
- `filter[chain_ids]`: `base,ethereum,arbitrum`
- `filter[trash]`: `only_non_trash` (exclude spam)
- `sort`: `value` (by USD value)

Response includes:
- Token symbol, name, icon
- Quantity and USD value
- Protocol name (for DeFi positions)
- Position type: `wallet`, `deposited`, `borrowed`, `staked`, `locked`

### Transactions

Get interpreted transaction history:

```
GET /v1/wallets/{address}/transactions
```

Query params:
- `filter[chain_ids]`: Filter by chains
- `page[size]`: Number of transactions (default 20)

Each transaction includes:
- `operation_type`: `trade`, `send`, `receive`, `approve`, `stake`, `unstake`, `borrow`, `repay`, `bridge`, `mint`, `burn`
- Human-readable `transfers` array with token info
- USD values at time of transaction
- Gas fees in native token and USD

### Profit & Loss

Get wallet-level PnL:

```
GET /v1/wallets/{address}/pnl
```

Response:
```json
{
  "data": {
    "attributes": {
      "total_gain": -15076.15,
      "realized_gain": 45328.28,
      "unrealized_gain": -60404.44,
      "total_invested": 266672.34,
      "total_fee": 681.81
    }
  }
}
```

## x402 Access (Recommended for Agents)

x402 allows agents to pay per request without API keys. Payment is $0.01 USDC on Base.

```typescript
// Using x402 HTTP flow
const response = await fetch('https://api.zerion.io/v1/wallets/0x.../portfolio', {
  headers: {
    'X-402-Payment': signedPaymentHeader // ERC-3009 signature
  }
});
```

With zerion-cli:
```bash
zerion-cli wallet portfolio 0x... --x402
```

## API Key Access

Get a free API key instantly — no credit card required:

1. Go to [dashboard.zerion.io](https://dashboard.zerion.io)
2. Sign up with email or connect wallet
3. Click "Create API Key" — key starts with `zk_...`
4. Copy and use immediately

```bash
export ZERION_API_KEY="zk_your_api_key"

curl "https://api.zerion.io/v1/wallets/0x.../portfolio" \
  -H "Authorization: Basic $(echo -n $ZERION_API_KEY: | base64)"
```

### Rate Limits

| Plan | Requests/Second | Requests/Day | Price |
|------|-----------------|--------------|-------|
| Free | 10 | 10,000 | $0 |
| Growth | 50 | 100,000 | $99/mo |
| Scale | 200 | 1,000,000 | $499/mo |
| Enterprise | Custom | Custom | Contact |

x402 has no rate limits — pay per request ($0.01 USDC each).

## Webhooks

Subscribe to real-time wallet events:

```
POST /v1/webhooks
{
  "wallet_address": "0x...",
  "events": ["transaction", "position_change"],
  "url": "https://your-server/webhook/zerion"
}
```

Webhook payloads include:
- New transactions with full interpretation
- Position value changes
- Large transfers (configurable threshold)

## Integration with Bankr

### Example: PnL Guardian

Monitor positions and auto-set stop-losses:

```bash
#!/bin/bash
# Research with Zerion
positions=$(zerion-cli wallet positions $WALLET --json)

# Find volatile tokens on Base
risky=$(echo $positions | jq '[.data[] | select(.relationships.chain.data.id == "base") | select(.attributes.value > 500)]')

# Execute with Bankr
for token in $(echo $risky | jq -r '.[].attributes.fungible_info.symbol'); do
  bankr "set stop loss on $token at -20%"
done
```

### Example: Whale Copy Trading

Watch a whale wallet and mirror trades:

```typescript
// Webhook handler
app.post('/webhook/zerion', async (req, res) => {
  const { type, data } = req.body;

  if (type === 'transaction' && data.operation_type === 'trade') {
    const { transfers } = data;
    const bought = transfers.find(t => t.direction === 'in');

    if (bought && bought.value > 1000) {
      // Mirror the trade via Bankr
      await bankr(`buy $100 of ${bought.fungible_info.symbol}`);
    }
  }
});
```

## Supported Chains

All 41+ chains including:

| Chain | Chain ID |
|-------|----------|
| Ethereum | `ethereum` |
| Base | `base` |
| Arbitrum | `arbitrum` |
| Optimism | `optimism` |
| Polygon | `polygon` |
| Solana | `solana` |
| zkSync Era | `zksync-era` |
| Linea | `linea` |
| Scroll | `scroll` |
| Blast | `blast` |
| Zora | `zora` |
| Degen | `degen` |
| ... | +30 more |

Full list: https://developers.zerion.io/reference/chains

## MCP Server

Connect Claude, Cursor, or any MCP client:

```json
{
  "mcpServers": {
    "zerion": {
      "command": "npx",
      "args": ["zerion-mcp-server"],
      "env": {
        "ZERION_API_KEY": "zk_..."
      }
    }
  }
}
```

## Error Handling

- **401 Unauthorized**: Invalid or missing API key
- **402 Payment Required**: x402 payment needed or failed
- **404 Not Found**: Invalid wallet address format
- **429 Rate Limited**: Back off and retry with exponential backoff
- **400 Bad Request**: Check query params (chain IDs, filters)

## Resources

- **Get API Key**: https://dashboard.zerion.io (free, instant, no credit card)
- **API Documentation**: https://developers.zerion.io
- **CLI Repository**: https://github.com/zeriontech/zerion-cli
- **MCP Server**: https://github.com/zeriontech/zerion-mcp-server
- **x402 Protocol**: https://developers.zerion.io/reference/x402
- **Zerion for Agents**: https://zerion.io/agents
