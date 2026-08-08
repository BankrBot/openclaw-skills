# Win-broadcast — `GET /api/partner/resolved`

`GET https://www.playhunch.xyz/api/partner/resolved?wallet=<0x…>`

A wallet's **settled** Hunch bets (won + lost), newest first, each with a
ready-to-post **`broadcast`** line, plus a wallet-level **`digest`**. This is the
loop-closing surface: when a bet settles, reply in its original thread so the win
(and the on-chain proof) is *seen*, not silent. Read-only — no payment, no money
path. Positions are keyed `bankr:<wallet>`, exactly as the x402 trade wrote them.

404 when the partner API is off; `422 wallet_required` without a valid wallet;
CORS-open.

## Request

```
GET /api/partner/resolved?wallet=0x1234…abcd
```

## Response

```json
{
  "meta": { "name": "…", "version": "hunch-partner-api-v1", "generatedAt": "…", "docsUrl": "…" },
  "wallet": "0x1234…abcd",
  "count": 2,
  "summary": { "wonCount": 1, "lostCount": 1, "netPnlUsd": -1.6, "totalWonUsd": 8.4 },
  "resolved": [
    {
      "marketId": "bankr-100m-mcap-2026-06-30",
      "slug": "bankr-100m",
      "question": "Will $BNKR reach a $100M market cap by June 30, 2026?",
      "shortTitle": "$BNKR → $100M",
      "side": "yes",
      "outcomeLabel": "YES",
      "won": true,
      "shares": 40.83,
      "stakedUsd": 5,
      "avgEntryCents": 12,
      "currentCents": 100,
      "pnlUsd": 3.4,
      "maxPayoutUsd": 8.4,
      "status": "resolved-won",
      "appUrl": "https://www.playhunch.xyz/markets/bankr-100m",
      "proofUrl": "https://basescan.org/tx/0x…",
      "filledAt": "2026-06-01T00:00:00.000Z",
      "broadcast": "🎉 Won $8.40 on $BNKR → $100M (YES) — settled in USDC on Base. Proof: https://www.playhunch.xyz/markets/bankr-100m. Run it back? Tag @bankrbot. @playhunchxyz"
    }
  ],
  "digest": {
    "title": "🎯 Settled on Hunch",
    "lines": ["✅ Won $8.40 — $BNKR → $100M (YES)", "❌ $HUNCH flips $LFI (YES)"],
    "text": "🎯 Settled on Hunch\n✅ Won $8.40 — $BNKR → $100M (YES)\n❌ $HUNCH flips $LFI (YES)\n\nRun it back — tag @bankrbot to bet, settles in USDC on Base. @playhunchxyz"
  }
}
```

## Fields

Each `resolved[]` entry is the [position](./positions.md) shape (so `pnlUsd`,
`maxPayoutUsd`, `proofUrl`, etc. mean the same) plus:

| Field | Meaning |
|---|---|
| `won` | `true` for `resolved-won`, `false` for `resolved-lost`. The broadcast headline. |
| `shortTitle` | Tweet-length market title (falls back to the full `question`). |
| `broadcast` | **Ready-to-post one-liner.** A win leads with the payout + the proof link + a rematch CTA; a loss is a rematch nudge, never a dunk. **Ends with the project @tags** (`@playhunchxyz` + the token project). Reply with this verbatim in the original bet thread — keep the tags. |
| `appUrl` | The durable market page (shows the resolved outcome + pool) — the proof link used in the `broadcast`. |
| `maxPayoutUsd` | The realized payout for a win (parimutuel, from the settled book); `0` for a loss. |

`summary`: `wonCount`, `lostCount`, `netPnlUsd` (net realized PnL across settled
bets), `totalWonUsd` (sum of winning payouts). `digest`: `{ title, lines, text }`
— `text` is a post-ready "here's how it settled" recap (same pattern as
`trending.digest`).

## Using it

- **In-thread reply (the high-value path).** When a bet settles, reply to its
  original cast with that entry's `broadcast`. The winner gets their flex + proof;
  spectators see a real payout on Base and a "rematch?" hook. (You know *which* cast
  from your own trade-time mapping — see *Dedupe + thread mapping* below; the
  response itself carries no thread id.)
- **Recap post.** Drop `digest.text` verbatim as a "your week on Hunch" post.

## Dedupe + thread mapping (you hold the state)

The endpoint is **stateless** — it reports the *current* resolved set every time,
and it returns **no `mentionId` / thread id**. Each entry is an aggregated
**position** (it can span several bets / casts on the same market + side), so Hunch
can't know which cast to reply under — only the bot does. Two pieces of state the
bot owns:

- **Dedupe.** Announce each settled bet **once**: track what you've already
  broadcast by `wallet` + `marketId`.
- **Thread mapping.** To reply in the *original* bet thread, **persist the cast↔bet
  link at trade time** — when you `POST /trade` you already pass `mentionId`; record
  `(walletAddress, marketId) → mentionId`/thread alongside your dedupe state. On
  settle, match the resolved entry's `wallet` + `marketId` back to that thread. (No
  stored mapping → post a fresh cast, never the wrong thread.)

Either poll on a cadence, or check `resolved` right after `result` (see `result.md`)
flips a market to `resolved`. The model never picks anything here — it's a read over
the wallet's own settled positions, formatted for posting.
