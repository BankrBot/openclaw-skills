# Proof read

`GET https://www.playhunch.xyz/api/partner/proof/{tradeId}`

The durable, shareable proof for a settled partner bet — `tradeId` is the
`idemKey` you used (returned as `tradeId` / in `proofUrl` from `trade`). The
cryptographic proof IS the on-chain Base USDC settlement: this endpoint surfaces
the tx hash + BaseScan link alongside the market and the wallet-keyed position,
read straight from storage so it survives serverless cold starts. Read-only,
no-store. 404 when the partner API is off.

Use for: "show me proof of my bet", a "verified on-chain" link in any reply, or
reconciling a trade whose response you lost.

### Response (settled trade)

```json
{
  "meta": { … },
  "tradeId": "<idemKey>",
  "market": { … shared market ref … },
  "position": {
    "userId": "bankr:0x…",
    "walletAddress": "0x…",
    "side": "yes",
    "shares": 40.83,
    "priceCents": 12,
    "sizeUsd": 5,
    "feeUsd": 0.1
  },
  "settlement": {
    "txHash": "0x…",
    "explorerUrl": "https://basescan.org/tx/0x…",
    "status": "confirmed",
    "network": "base",
    "settledAt": "2026-06-01T12:00:00.000Z"
  },
  "attribution": { "source": "bankr", "mentionId": "<post id>" }
}
```

| Block | Field | Meaning |
|---|---|---|
| — | `tradeId` | The trade's id (= `idemKey`). |
| `market` | | The shared [market ref](./market-ref.md). If the market is no longer in the catalogue, this degrades to `{ "id": "<marketId>" }`. |
| `position` | `userId` | `bankr:<lower-wallet>`. |
| | `walletAddress` | The paying wallet. |
| | `side` / `shares` / `priceCents` | The fill. |
| | `sizeUsd` / `feeUsd` | Staked / fee, USD. |
| `settlement` | `txHash` / `explorerUrl` | The on-chain Base tx — **the proof**. |
| | `status` | `submitted` or `confirmed`. |
| | `network` | `base`. |
| | `settledAt` | When it filled. |
| `attribution` | `source` / `mentionId` | The `ref` + mention id passed at trade time. |

### Errors

| Status | `error` | Meaning |
|---|---|---|
| `404` | `proof_not_found` | No settled partner trade with that id (also covers staged/cancelled rows and non-partner fills — only settled `bankr:*` trades surface). |
| `404` | `partner_api_disabled` | Endpoint is off. |
| `503` | `proof_unavailable` | Proof storage isn't configured / a read error. |

### Reply shape

> ✅ **Verified on-chain.** YES on $BNKR → $100M, $5 → 40.83 shares.
> [BaseScan ↗](https://basescan.org/tx/0x…)
