# Leaderboard reference (`leaderboard` table)

Read-only for this skill. Same Supabase project and publishable key as `matches`.

- Endpoint: `${URL}/rest/v1/leaderboard`
- Headers: `apikey: <key>`, `Authorization: Bearer <key>`

## Columns

| Column | Meaning |
| --- | --- |
| `handle` | Player X/Farcaster @handle (tag target). May be null/`anon`. |
| `display_name` | Display name (falls back to `handle`) |
| `avatar` | Avatar URL |
| `wallet` | Player wallet (optional) |
| `score` | Run score (integer) |
| `coin` | The **track** the run was played on (BNKR, BTC, …) — informational only |
| `flips` | In-run stat |
| `ts` | Unix ms timestamp of the run (fall back to `created_at` if absent) |

Each row is one **run** (the single-player endless game), not a PvP result. A player can
have many rows; boards show each player's **best** score.

## Fetch + rank

```
GET ${URL}/rest/v1/leaderboard?select=*&order=score.desc&limit=500
```

Then, client-side:
1. **Period filter**
   - Monthly: keep rows with `ts >= startOfCurrentMonth` (1st of the month, local 00:00).
     The monthly board resets to zero each month.
   - All-time (Hall of Fame): keep all rows.
   - (The app also supports a 7-day "week" view: `ts >= now - 7*86400000`.)
2. **Dedupe by `handle`** (case-insensitive), keeping the row with the highest `score`.
3. Sort by `score` descending. Rank 0,1,2 = 🥇🥈🥉.

## Monthly prizes

Top 3 of the **monthly** board split that month's live $RIDER prize pool:
🥇 50% · 🥈 30% · 🥉 20%. All-time is bragging rights only (no prize). The exact pool is a
live estimate shown in the app; the skill doesn't need to compute it — just note the top 3
are in prize positions when listing the monthly board.

## Handle sources & who is X-taggable

The `handle` is set at login and its origin is only knowable from `avatar`:

| Login | `handle` | `avatar` | X-taggable? |
| --- | --- | --- | --- |
| X | X username | `https://unavatar.io/twitter/<handle>` (or `twimg.com`) | ✅ tag `@{handle}` |
| Farcaster | Farcaster username / display name | Farcaster pfp (`imagedelivery.net`, `warpcast`, …) | ❌ plain text |
| Wallet only | shortened address `0x…` | null | ❌ show short wallet |

So a correct-looking pfp does NOT mean the person is on X — it may be their Farcaster or
wallet avatar. Only `@`-mention rows whose `avatar` is a Twitter/X URL; render everything
else as plain text. Always strip a leading `@` from `handle` before composing, and never
emit `@@`. Handles are self-entered, so treat tagging as best-effort.

## Output shape (suggested)

```
🏆 Monthly Rider leaderboard
🥇 @alice — 82,140 pts (track BNKR)
🥈 @bob — 77,020 pts (track BTC)
🥉 @carol — 71,500 pts (track SOL)
4. @dave — 68,300 pts
5. @erin — 65,110 pts
Top 3 split this month's $RIDER prize pool.
```

Tag only the players you list (respect the requested count); never mass-tag.
