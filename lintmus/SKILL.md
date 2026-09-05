# Lintmus

Token due diligence for the bankr.bot ecosystem. Get a safety score, honeypot detection, liquidity health, and deployer history for any EVM or Solana token — before you trade.

## Install

```
install the lintmus skill from https://github.com/lintmus/lintmus
```

## Core Capabilities

Lintmus analyzes a token contract and returns:

- **Safety score** (0–100) — aggregated from all data sources
- **Honeypot detection** — via GoPlus Security and honeypot.is
- **Tax analysis** — buy/sell tax percentages
- **Ownership flags** — mintable, hidden owner, pausable, blacklist
- **Liquidity** — USD liquidity, 24h volume, LP lock status
- **Age** — how long the token has been trading
- **Social signals** — website and social links presence
- **Liquidity seeding detection** — new tokens with suspiciously high liquidity
- **Malicious holder detection** — top holders flagged by GoPlus
- **Contract verification** — is source code public?
- **Deployer history** — cross-chain rug history via Alchemy (Base, ETH, Polygon)

## Usage

Once installed, ask your agent:

```
analyze token 0x532f27101965dd16442e59d40670faf5ebb142e4 on base
```

```
is this token safe? 0xADDRESS on ethereum
```

```
run lintmus on 0xADDRESS before I buy
```

## Supported chains

- `base` — Base mainnet
- `eth` — Ethereum mainnet
- `polygon` — Polygon
- `solana` — Solana

## Pricing

**0.03 USDC per report** — paid via x402 on Base.

Reports are cached for 60 minutes. If the same token is analyzed twice within an hour, the second request is free.

## Endpoint

```
POST https://x402.bankr.bot/0x8901c544cfb3f1e87ae80e66154b04aee5f0448f/Lintmus
Content-Type: application/json

{
  "address": "0x532f27101965dd16442e59d40670faf5ebb142e4",
  "chain": "base"
}
```

## Data sources

- [GoPlus Security](https://gopluslabs.io) — honeypot, tax, ownership flags
- [DexScreener](https://dexscreener.com) — liquidity, volume, price
- [Etherscan API V2](https://etherscan.io) — contract verification
- [Alchemy](https://alchemy.com) — deployer address lookup

## About

Built on the bankr.bot infrastructure layer. The Lintmus rug database grows with every analysis — historical accuracy data is published openly so anyone can verify the scoring methodology.

Token: $LINTMUS on Base
