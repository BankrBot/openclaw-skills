# BundleScope — LoneStarOracle

Token launch bundle and sniper detection on Base. Scans the first 3 blocks after a token launches to identify same-block coordinated buys, then checks whether those early wallets are still holding or have dumped into retail.

## Overview

BundleScope pulls the first 200 token transfers after a contract goes live, groups by block, and identifies wallets that bought in the same block as the first trade. It then checks each wallet current balance to determine if they are still holding or have sold into retail buyers.

## Getting Started

No API key required. Pay $0.10 USDC per scan via x402 on Base mainnet.

```
GET https://bundle.lonestaroracle.xyz/scan?address=0x<TOKEN_CONTRACT>
```

## Core Features

- Same-block detection: flags wallets that bought in the exact same block as launch
- Dump tracking: checks current token balance for each early wallet
- Risk scoring: 1-10 score based on bundle count and dump rate
- Top 20 wallets: ranked by buy size with full hold/dump breakdown
- Plain-English verdict: actionable summary of what the data shows

## API Reference

### GET /scan

**Base URL:** https://bundle.lonestaroracle.xyz

**Method:** GET

**Auth:** x402 — $0.10 USDC on Base mainnet

**Parameters:**

| Parameter | Type | Required | Description |
|---|---|---|---|
| address | string | Yes | ERC-20 contract address on Base (0x...) |

**Response:**

```json
{
  "address": "0x...",
  "chain": "base",
  "launch_block": 12345678,
  "risk_score": 8,
  "risk_level": "HIGH",
  "bundle_summary": {
    "launch_window_buyers": 24,
    "launch_block_buyers": 15,
    "still_holding": 3,
    "fully_dumped": 17,
    "dump_rate_pct": 70.8
  },
  "wallets": [
    {
      "address": "0x...",
      "tokens_bought": 1500000.0,
      "current_balance": 0.0,
      "dump_pct": 100.0,
      "status": "DUMPED",
      "launch_block_buyer": true
    }
  ],
  "verdict": "HIGH — 15 wallets bundled the launch, 71% have dumped into retail."
}
```

**Risk Levels:** LOW (1-3) / MEDIUM (4-5) / HIGH (6-7) / CRITICAL (8-10)

## Payment

x402 protocol on Base mainnet — $0.10 USDC per scan

payTo: 0x52Ab53912D37759B2ad364f22dD06B16714b6C06

## Provider

LoneStarOracle — https://lonestaroracle.xyz — 39 x402 services live on Base
