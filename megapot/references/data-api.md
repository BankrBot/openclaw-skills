# Megapot Data API — limited scope

This skill uses the Megapot Data API at `https://api.megapot.io/v1` for **one purpose only**: discovering a user's unclaimed winnings so they can be claimed.

The skill is published **without an API key** and uses the anonymous rate tier. This is a deliberate scope-limiting decision — broader API features (wallet history, leaderboards, round history) are intentionally not implemented to keep request volume minimal.

## Rate limits — anonymous tier

| Limit | Value |
|---|---|
| Requests per minute | 10 |
| Requests per day | 500 |
| Headers returned | `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`, `X-RateLimit-Tier` |
| On 429 | `Retry-After` header (seconds until rate limit resets) |

The budget is **shared across all anonymous traffic from the same egress IP**. Because Bankr's hosted runtime egresses through a small pool of IPs, the per-Bankr-user effective budget is much smaller than 500/day. **Expect intermittent 429s during peak hours.**

## Mandatory error handling

When calling this API, the agent **must** handle these response cases:

| Response | Required behavior |
|---|---|
| `200` with `data: [...]` | Proceed — these are unclaimed wins (the `?claimed=false` filter is server-side) |
| `200` with `data: []` | Tell the user they have no unclaimed winnings on record for this wallet |
| `429` (rate-limited) | Do **not** retry. Read the `Retry-After` header and tell the user: "I can't check the win lookup right now — try again in N seconds, or check your wins at https://megapot.io directly." Then stop. |
| `5xx` | Same as 429 — deflect to megapot.io. Do not retry in a loop. |
| Network failure | Same as 429 — deflect. |

Never silently fail. Never pretend a 429 means "no winnings." Never retry on a backoff schedule longer than ~5 seconds — the user is waiting.

## The one endpoint we use

```
GET https://api.megapot.io/v1/wallets/{address}/wins?claimed=false&limit=50
```

No `Authorization` header. No API key. Lowercase the address before substitution.

The `?claimed=false` filter is server-side — the response contains only unclaimed wins. No client-side filtering needed.

## Response shape

```json
{
  "data": [
    {
      "id": "12345",
      "wallet": "0x1111111111111111111111111111111111111111",
      "buyer": "0x2222222222222222222222222222222222222222",
      "round_id": "172",
      "user_ticket_id": "47",
      "normals": [3, 17, 25, 38, 49],
      "bonusball": 7,
      "claimed": false,
      "claimed_tx_hash": null,
      "tx_hash": "0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef",
      "matched_normals": 4,
      "bonusball_match": true,
      "amount": { "amount": "183029000000", "decimals": 6 }
    }
  ],
  "next_cursor": "eyJzb3J0X2tleV92YWx1ZSI6...",
  "has_more": true
}
```

`amount.amount` is a string in USDC raw units (6 decimals). Divide by `1_000_000` and format with thousands separators for display.

## What this skill does NOT use the API for

To minimize anonymous-tier consumption, the following are **not** supported by this skill and remain deflected to `https://megapot.io`:

- Wallet lifetime stats (total tickets bought, total winnings)
- Full ticket history across drawings
- Round-by-round history browsing
- Leaderboards (top wins per round)
- Any cross-drawing aggregate queries

If users ask for any of the above, direct them to `https://megapot.io` and do not call the API.

## Pagination

For users with many unclaimed wins, paginate with `?claimed=false&cursor=<next_cursor>&limit=50`. Stop after **2 pages maximum** (100 wins) — anyone with more than 100 unclaimed winning tickets is a power user who should use megapot.io directly. Each page is one API call against the budget.
