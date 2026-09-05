# GM Bankr, what's up today?

Stop repeating the same Bankr checks every morning.

Send:

```text
GM
```

and receive a personalized Bankr morning briefing that can be read in under 30 seconds.

No automatic trading. No guessed data. Less noise, with only the verified information that matters today.

MVP Skill repository for a text-only Bankr morning briefing triggered by `GM`.

## What this skill does

When the user sends `GM`, the skill returns a concise morning summary that can be read in under 30 seconds:

- Greeting
- BNKR price from the formal Bankr Runtime price tool, with 24-hour change when available
- Bankr leaderboard rank only when `search_tool` can verify the current rank from a public page
- Open Positions from Hyperliquid, Avantis, and Polymarket runtime tools
- Today's Highlight from the last 24 hours
- Today's Watch, with no investment advice
- Today's Mission, with safe read-only actions
- GM Streak
- User setting persistence

## What this skill does not do

- It does not create a web app or iframe app.
- It does not execute trades, approvals, signatures, deposits, withdrawals, or orders.
- It does not provide investment advice.
- It does not implement x402.
- It does not implement weekly reports.
- It does not implement monthly reports.
- It does not implement Builder Score analysis.

## Difference from Bankr core features

This skill is a presentation and workflow layer for a daily `GM` briefing. It does not replace Bankr's core product features, market tools, wallet actions, leaderboard systems, trading tools, or protocol integrations. It only calls formally available Bankr/runtime tools, formats the returned data, applies user preferences, stores lightweight per-user memory, and omits unavailable data without guessing.

## Official tool usage

Use these formal Bankr Runtime tool identifiers exactly:

| Capability | Official runtime tool name | Status |
| --- | --- | --- |
| BNKR price | `gettokenpriceinusd` | Confirmed |
| Bankr leaderboard rank | No formal runtime tool; use `search_tool` public-page lookup only | Search-only |
| Hyperliquid open positions | `gethyperliquidpositions` | Confirmed |
| Avantis open positions | `getavantisopen_positions` | Confirmed |
| Polymarket open positions | `viewpolymarketpositions` | Confirmed |
| News/search for Highlight and Watch | `search_tool` | Confirmed |

BNKR price must be fetched with `chain: base` and `tokenAddress: 0x22af33fe49fd1fa80c7149773dde5890d3c76f3b`.

Fetch BNKR, Hyperliquid, Avantis, Polymarket, and search data in parallel whenever the runtime allows it. If one fetch fails, omit only that section and continue rendering the other successful sections. Do not show raw errors.

For `search_tool`, include `today` and `last 24 hours` in queries. Check `publishedDate`; do not include Highlight or Watch items older than 24 hours.

## Open Positions handling

Open Positions combines:

- Hyperliquid `positions`
- Avantis `positions`
- Polymarket `live`
- Polymarket `claimable`

Call `viewpolymarketpositions` with `includeLost: false` for regular `GM`, `short`, and `normal` modes. Use `includeLost: true` only in `detailed` mode or when the user explicitly asks for lost/resolved-lost Polymarket history.

Polymarket `recentlyResolvedLost` is displayed only when `includeLost: true` was used and the tool actually returned it. Do not infer or backfill lost history from memory.

## Leaderboard handling

There is no formal Bankr Runtime leaderboard tool. Use `search_tool` to look for a public page that verifies the user's current Bankr rank. If the current rank cannot be verified, omit Leaderboard naturally. Do not use `previousLeaderboardRank` as a current rank and do not ask the user to manually enter their rank every morning.

## Memory files

The skill reads and writes:

- `/.memory/gm-bankr-settings.json`
- `/.memory/gm-bankr-history.json`

See `references/memory-schema.md`.

## Test cases

### 1. Initial GM

Prompt: `GM`

Expected:

- Creates default settings/history if missing.
- Shows enabled sections with verified data only.
- Uses `gettokenpriceinusd`, positions tools, and `search_tool` where enabled.
- Omits only failed or unverified sections.
- Includes Today's Mission with read-only actions only.
- Ends with a disclaimer in the user's language.

### 2. Two-day GM streak

Setup:

- `lastCheckDate` is yesterday in the user's local timezone.
- `gmStreak` is `1`.

Prompt: `GM`

Expected:

- Updates `gmStreak` to `2`.
- Updates `lastCheckDate` to today.
- Shows streak if enabled.

### 3. No open positions

Prompt: `GM`

Expected:

- If official position tools return empty results, show a short "Open Positions" line indicating no open positions.
- Do not invent venues, sizes, PnL, entry prices, or markets.

### 4. Partial tool fetch failure

Setup:

- `gettokenpriceinusd` succeeds.
- Leaderboard lookup through `search_tool` or one positions venue fails.

Prompt: `GM`

Expected:

- Shows BNKR.
- Omits unavailable sections or venues naturally.
- Does not display raw errors.

### 5. User hides Solana

Prompt: `Solanaを非表示にして。GM`

Expected:

- Adds `Solana` to hidden topics.
- Excludes Solana from Highlight and Watch.
- Still allows Bankr/Base/Robinhood Chain items when verified.

### 6. Short mode

Prompt: `Shortモードにして。GM`

Expected:

- Sets report length to `short`.
- Outputs the smallest valid briefing, ideally one bullet per enabled available section.
- Keeps Today's Mission to one read-only item.
- Keeps the investment-advice disclaimer in the user's language.

### 7. Leaderboard unavailable

Setup:

- No official leaderboard tool/source is available.

Prompt: `GM`

Expected:

- Omits leaderboard entirely.
- Does not say or imply a guessed rank.
- Does not update `previousLeaderboardRank` with a guessed value.

### 8. English GM

Prompt: `GM`

Expected:

- Responds in English if the user's context is English.
- Includes `This is not investment advice.`
- Does not use the Japanese disclaimer unless the user is writing in Japanese.

### 9. Formal runtime tools

Prompt: `GM`

Expected:

- BNKR uses `gettokenpriceinusd` with `chain: base` and `tokenAddress: 0x22af33fe49fd1fa80c7149773dde5890d3c76f3b`.
- Hyperliquid uses `gethyperliquidpositions`.
- Avantis uses `getavantisopen_positions`.
- Polymarket uses `viewpolymarketpositions` with `includeLost: false` for regular `GM`, `short`, and `normal` modes.
- Highlight and Watch use `search_tool` queries containing `today` and `last 24 hours`.

### 10. Polymarket claimable and normal lost handling

Prompt: `GM`

Expected:

- Shows Polymarket `live` positions when present.
- Shows Polymarket `claimable` winnings when present.
- Does not show `recentlyResolvedLost` in normal mode.

### 11. Polymarket detailed lost handling

Prompt: `詳細モードにして。GM`

Expected:

- Uses `includeLost: true` in detailed mode.
- Shows `recentlyResolvedLost` only when `includeLost: true` was used and the tool actually returned it.

### 12. Polymarket explicit lost request

Prompt: `Polymarketの負けた履歴も見せて。GM`

Expected:

- Uses `includeLost: true` because the user explicitly requested lost history.
- Shows `recentlyResolvedLost` only when `includeLost: true` was used and the tool actually returned it.
- Does not infer or backfill lost history from memory.

## Bankr test prompts

- `GM`
- `Shortモードにして。GM`
- `LeaderboardをOFFにして。GM`
- `BNKRとStreakだけ表示して。GM`
- `Solanaを非表示にして。GM`
- `詳細モードにして。GM`
- `Polymarketの負けた履歴も見せて。GM`
- `Open PositionsをOFFにして。GM`

## Skill Store pre-submit checklist

- Confirm the current Bankr Skill submission format still accepts `SKILL.md` plus `references/`.
- Confirm `search_tool` result objects expose a reliable `publishedDate` for 24-hour filtering.
- Confirm whether `gettokenpriceinusd` or another verified source provides 24-hour BNKR change; if not, show price and confidence only.
- Confirm the runtime allows reading/writing `/.memory/gm-bankr-settings.json` and `/.memory/gm-bankr-history.json`.
- Confirm timezone handling for daily streaks in the Bankr host.
- Confirm source-link rendering rules in Bankr responses.
