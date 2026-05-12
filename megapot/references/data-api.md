# Megapot Data API — limited scope

This skill uses the Megapot Data API at `https://api.megapot.io/v1` for **one purpose only**: discovering a user's unclaimed winnings so they can be claimed.

The skill is published **without an API key** and uses the anonymous rate tier. This is a deliberate scope-limiting decision — broader API features (wallet history, leaderboards, round history) are intentionally not implemented to keep request volume minimal.

## Rate limits — anonymous tier

| Limit | Value |
|---|---|
| Requests per minute | 10 |
| Requests per day | 500 |
| Headers returned | `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`, `X-RateLimit-Tier` |

The budget is **shared across all anonymous traffic from the same egress IP**. Because Bankr's hosted runtime egresses through a small pool of IPs, the per-Bankr-user effective budget is much smaller than 500/day. **Expect intermittent 429s during peak hours.**

## Mandatory error handling

When calling this API, the agent **must** handle these response cases:

| Response | Required behavior |
|---|---|
| `200` with `data: [...]` | Proceed — use the returned wins |
| `200` with `data: []` | Tell the user they have no winnings on record for this wallet |
| `429` (rate-limited) | Do **not** retry. Tell the user: "I can't check the win lookup right now — please try in a minute, or check your wins at https://megapot.io directly." Then stop. |
| `5xx` | Same as 429 — deflect to megapot.io. Do not retry in a loop. |
| Network failure | Same as 429 — deflect. |

Never silently fail. Never pretend a 429 means "no winnings." Never retry on a backoff schedule longer than ~5 seconds — the user is waiting.

## The one endpoint we use

```
GET https://api.megapot.io/v1/wallets/{address}/wins?limit=50
```

No `Authorization` header. No API key. Lowercase the address before substitution.

## Response shape

```json
{
  "data": [
    {
      "id": "285676",
      "wallet": "0x42628784F87ce4e685eA3670477cF2f06aA104B4",
      "buyer": "0xb9A1e63750F63b4E0a0B546A010d18D4517B3619",
      "round_id": "48",
      "user_ticket_id": "44227164116923236463185274704862652451657132813109550392917795255542930316355",
      "normals": [2, 5, 10, 16, 19],
      "bonusball": 11,
      "claimed": true,
      "claimed_tx_hash": "0x611a152a...",
      "tx_hash": "0xdbadadad...",
      "matched_normals": 4,
      "bonusball_match": false,
      "amount": { "amount": "26755696", "decimals": 6 }
    }
  ],
  "next_cursor": "eyJzb3J0X2tleV92YWx1ZSI6...",
  "has_more": true
}
```

## Filtering for claimable wins

The agent should filter the response client-side:

- **`claimed === false`** → claimable, present to user
- **`claimed === true`** → already claimed, skip (don't surface unless the user explicitly asks for claim history)

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

For users with many wins, paginate with `?cursor=<next_cursor>&limit=50`. Stop after **2 pages maximum** (100 wins) — anyone with more than 100 winning tickets is a power user who should use megapot.io directly. Each page is one API call against the budget.
