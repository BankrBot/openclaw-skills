# Positions / portfolio lookup

`GET https://www.playhunch.xyz/api/partner/positions?wallet=<0x…>`

Read-only. Returns every Hunch position held by a wallet — the same wallet that
paid for the bets via x402 (positions are keyed `bankr:<lower-wallet>`, the exact
id the trade path writes). No payment, no money path. An unknown wallet (or no DB)
fails soft to an empty list. 404 when the partner API is off; `422 wallet_required`
when `wallet` is missing or not a valid `0x` address.

Use for: "show my Hunch bets", "how are my positions doing", "what's my PnL".

### Response

```json
{
  "meta": { "name": "…", "version": "hunch-partner-api-v1", "generatedAt": "…", "docsUrl": "…" },
  "wallet": "0xabc…",
  "count": 2,
  "summary": {
    "openCount": 1,
    "resolvedCount": 1,
    "totalStakedUsd": 8.0,
    "totalPnlUsd": 1.42
  },
  "positions": [
    {
      "marketId": "bankr-100m-mcap-2026-06-30",
      "slug": "bankr-100m-mcap-2026-06-30",
      "question": "Will $BNKR reach a $100M market cap by June 30, 2026?",
      "side": "yes",
      "outcomeLabel": "YES",
      "shares": 41.6,
      "stakedUsd": 5.0,
      "avgEntryCents": 12,
      "currentCents": 15,
      "pnlUsd": 1.25,
      "maxPayoutUsd": 41.6,
      "status": "open",
      "appUrl": "https://www.playhunch.xyz/markets/bankr-100m-mcap-2026-06-30",
      "proofUrl": "https://basescan.org/tx/0x…",
      "filledAt": "2026-06-01T12:00:00.000Z"
    }
  ]
}
```

### Fields

| Field | Meaning |
|---|---|
| `outcomeLabel` | Display label for the side — `UP`/`DOWN` for price-direction rounds, a bucket label for ladders, else `YES`/`NO`. |
| `avgEntryCents` / `currentCents` | Entry price vs live price, in cents (¢ per share). |
| `pnlUsd` | Live mark-to-market P&L (current value − staked). |
| `maxPayoutUsd` | Payout if this side wins ($1 / share). |
| `status` | `open`, `resolved-won`, or `resolved-lost`. |
| `proofUrl` | Entry-settlement on-chain proof (BaseScan), when available. |

### Reply shape

> **Your Hunch bets** (1 open · 1 resolved · PnL +$1.42)
> • **$BNKR → $100M** — YES, $5 @ 12¢ → 15¢ · +$1.25 · open
> • **$HUNCH flips $LFI** — YES, $3 · resolved-lost
