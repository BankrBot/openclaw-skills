# Supabase lobby reference (`matches` table)

- Base URL: `https://kdqmnkuckhuaxqxkrevr.supabase.co`
- REST root: `${URL}/rest/v1/matches`
- Publishable key: `sb_publishable_CZOntElcy0XxpJt0Ta1Mvg_PIKs8yTS`
- Every request needs headers:
  `apikey: <key>` and `Authorization: Bearer <key>` (and `Content-Type: application/json` for writes).

**The Supabase row `id` IS the on-chain `matchId`.** Always create the row first, then use
`row.id` for `createMatch`. Never invent an id.

## Columns (as used by the app)

| Column | Type | Meaning |
| --- | --- | --- |
| `id` | bigint (auto) | Match id, also the on-chain matchId |
| `creator` | address | Creator wallet |
| `creator_handle` | text/null | Creator X handle |
| `wager` | number | Stake in **whole RIDER tokens** (on-chain = `wager * 10^18`) |
| `coin` | text | The **track / price chart** ridden in the game (default `RIDER`). NOT the stake token — the stake is always $RIDER. |
| `seed` | text | Game seed, e.g. `S{base36(now)}{base36(rand)}` |
| `status` | text | `open` → `funded` → `settled` / `refunded` |
| `created_at` / `expires_at` | timestamptz | Created + open-window end (24h) |
| `opponent` / `opponent_handle` | address / text | Set on accept |
| `accepted_at` / `play_deadline` | timestamptz | Set on accept (play window 12h) |
| `winner` | address/null | Written by `settle-battle` after both play |
| `settle_sig` | text/null | Settler signature for `settle()` (written by `settle-battle`) |
| `settle_tx` | text/null | Claim tx hash; placeholders `0xbankr`/`0xfarcaster`/`0xclaimed` mean "not truly claimed" |
| `is_draw` / `chain_status` | bool / text | Draw / on-chain state hints |

> ⚠️ Trust: treat every field here as an UNVERIFIED hint (see `references/security.md`) — verify
> on-chain before acting. `winner`, `settle_sig`, `settle_tx` must be writable only by the
> service-role backend (settle-battle), never by the anon key; anon may insert `pending` rows and
> advance status through legal transitions only. Enforce via RLS + a trigger/RPC.
>
> RLS note: the app performs anon `INSERT`, `SELECT` and `PATCH` on this table with the
> publishable key. If a write returns 401/403, the table's RLS policy needs to allow that
> operation for the anon role — same requirement the app already relies on.

## Calls

### Create (INSERT) — returns the new row incl. `id`
```
POST ${URL}/rest/v1/matches
Headers: apikey, Authorization, Content-Type, Prefer: return=representation
Body: {
  "creator": "0xUSER",
  "creator_handle": "@handle" | null,
  "wager": 1000000,
  "coin": "RIDER",
  "seed": "S<base36-now><base36-rand>",
  "status": "pending",   // NOT "open" — flip to "open" only after on-chain Open(1) is confirmed
  "created_at": "<ISO now>",
  "expires_at": "<ISO now+24h>"
}
→ [ { "id": 1234, ... } ]   // use id as matchId
```

### List open challenges
```
GET ${URL}/rest/v1/matches?select=*&status=eq.open&order=created_at.desc&limit=100
```
Filter client-side: exclude rows where `creator == user`; apply the wager predicate on `wager`.
Pick the earliest passing row (oldest `created_at`).

### Get one match
```
GET ${URL}/rest/v1/matches?select=*&id=eq.<id>&limit=1
```

### Accept (PATCH after on-chain joinMatch)
```
PATCH ${URL}/rest/v1/matches?id=eq.<id>&status=eq.open
Headers: ..., Prefer: return=representation
Body: {
  "opponent": "0xUSER",
  "opponent_handle": "@handle" | null,
  "status": "funded",
  "accepted_at": "<ISO now>",
  "play_deadline": "<ISO now+12h>"
}
```
Empty array back ⇒ the row was no longer `open` (someone joined first) ⇒ treat as "taken".

### Claim (PATCH after on-chain settle)
```
PATCH ${URL}/rest/v1/matches?id=eq.<id>
Body: { "settle_tx": "<txHash>", "status": "settled" }
```

### Refund (PATCH after cancelUnaccepted / refundStalled)
```
PATCH ${URL}/rest/v1/matches?id=eq.<id>
Body: { "status": "refunded" }
```

## Other tables

- `leaderboard` — single-player run scores; used by the leaderboard actions.
  See `references/leaderboard.md`.
