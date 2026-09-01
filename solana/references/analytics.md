# Analytics & Research

On-chain data and market research tools.

## Overview

This module provides data tools for informed trading decisions:
- Token price and volume data
- Wallet balance checks  
- Market search and discovery
- Historical data (where available)

## Price Commands

### Single Token Price

```bash
solana-native.sh price <token>
```

Supported tokens:
- `sol` / `SOL` / `solana`
- `jup` / `JUP` / `jupiter`
- `bonk` / `BONK`
- `ray` / `RAY` / `raydium`
- `jto` / `JTO` / `jito`

Or any CoinGecko ID.

**Example output:**
```
solana: $121.91 (-3.86% 24h)
```

### Multiple Prices

```bash
solana-native.sh prices
```

Returns all major Solana ecosystem tokens.

## Token Data (DexScreener)

### By Address

```bash
solana-native.sh dex <token_address>
```

Returns:
- Name, symbol
- Current price
- 24h price change
- Volume, liquidity
- FDV
- DEX info

**Example:**
```bash
solana-native.sh dex EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v
```

### Search

```bash
solana-native.sh search <query>
```

Search by name, symbol, or partial match.

**Example:**
```bash
solana-native.sh search BONK
solana-native.sh search cat
```

## Wallet Data

### Balance

```bash
solana-native.sh balance [address]
```

If no address provided, uses keypair from config.

**Example:**
```bash
solana-native.sh balance WJpQrYPSNWzNrRqKZk81awk3761PDcNCuN86FUxhJvy
# Output: Balance: 1.1771 SOL
```

### Token Accounts

For SPL token balances, use:
```bash
spl-token accounts --owner <address>
```

Or via RPC:
```bash
curl $RPC_URL -X POST -H "Content-Type: application/json" -d '{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "getTokenAccountsByOwner",
  "params": ["<address>", {"programId": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"}]
}'
```

## Network Status

### Current Slot

```bash
solana-native.sh slot
```

Returns the current Solana slot number.

### Health Check

```bash
curl $RPC_URL -X POST -H "Content-Type: application/json" -d '{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "getHealth"
}'
```

## Data Sources

| Source | Data | Auth Required |
|--------|------|---------------|
| CoinGecko | Prices, market cap | No (rate limited) |
| DexScreener | DEX data, search | No |
| Solana RPC | On-chain data | No (rate limited) |
| Helius | Enhanced data | Yes |
| Birdeye | Analytics | Yes |

## Rate Limits

### CoinGecko (Free)
- 10-30 calls/minute
- Sufficient for basic monitoring

### DexScreener
- Generous limits
- No auth required

### Solana RPC (Public)
- ~100 requests/10 seconds
- Use paid RPC for production

## Prompts for Agents

**Price checks:**
- "What's the price of SOL?"
- "Check JUP price"
- "Get me prices for all major Solana tokens"

**Token research:**
- "Look up token [address]"
- "Search for BONK on DexScreener"
- "Find cat-themed tokens on Solana"

**Wallet checks:**
- "Check my balance"
- "What's the balance of [address]?"
- "How much SOL does [wallet] have?"

**Network status:**
- "What's the current Solana slot?"
- "Is Solana network healthy?"

## Best Practices

1. **Cache when possible** - Don't fetch same data repeatedly
2. **Handle rate limits** - Implement backoff
3. **Verify data** - Cross-reference multiple sources
4. **Consider latency** - RPC location matters
5. **Use webhooks** - For real-time updates (requires paid services)
