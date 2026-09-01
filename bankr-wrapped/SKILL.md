---
name: bankr-wrapped
description: Shows a user's Bankr Wrapped — builder type, identity tier, tokens launched, Please Bro tokens, ETH earnings, best day, longest streak, and trading volume. Use when a user asks to see their Bankr Wrapped, their yearly recap, or their trading stats summary.
tags: [wrapped, stats, trading, recap]
version: 4
visibility: public
metadata:
  clawdbot:
    emoji: "🎁"
    homepage: "https://bankrwrapped.com"
---

# Bankr Wrapped

## Whose Wrapped to generate — read this first

This skill only generates a Wrapped for the person actually talking to you in this conversation — never for anyone else.

- The endpoint only accepts an **X/Bankr handle** as the identifier — it does not accept or resolve a wallet address. Calling it with an address (e.g. `/api/wrapped/0xabc...`) will always 404, even for a wallet with real activity, because the backend has no address-to-handle lookup.
- If the user asks for their own Wrapped without specifying a handle ("show me my bankr wrapped"), try to resolve their X/Bankr handle yourself first, using whatever native identity/session context you have access to — never use their wallet address as the identifier. If you can resolve it yourself, do so silently and don't ask.
- **Ask-once rule:** if you genuinely cannot resolve their handle yourself, ask for it **one time**. Once the user gives it (in this message or a reply), remember it for the rest of this conversation — do not ask again on later requests in the same thread, even if they ask for their Wrapped again later in the conversation.
- If the user asks for someone else's Wrapped (a different handle, someone else's @, "show me @someone's wrapped"), refuse. Respond with something like: "I can only pull up your own Bankr Wrapped, not someone else's — ask them to run this themselves." Do not fetch or fabricate data for that handle. This refusal does not require resolving your own identity — it only requires recognizing the request explicitly names a different handle than the one you're generating this Wrapped for.

## Fetching the data

Resolve the handle (strip any leading `@`) and call:

```
GET https://wrapped-production.up.railway.app/api/wrapped/<handle>
```

This is a real, live, rate-limited endpoint.

### Error handling — three distinct scenarios

1. **Backend unreachable / down** (connection error, 5xx response) — do not imply the user has no activity. Say something like: "Bankr Wrapped is temporarily unavailable — try again in a few minutes." Never show a partial or guessed response in this case.
2. **Request timeout** — say something like: "That took too long to load — Bankr Wrapped might be under load right now. Try again shortly." Do not retry aggressively; a single retry is fine, don't loop.
3. **`404` — handle not found** — `{ error: "handle not found on Bankr" }`. This means genuinely no Bankr account/activity exists for this handle. Tell the user plainly, don't imply it's a bug.
4. **Low/no activity user** (`200` response but `summary.hasActivity === false` or `tokens.length === 0` and no earnings) — this is not an error, it's a real state. Don't return an empty-looking response. Say something encouraging and on-brand, e.g.: "Nothing on the board yet — launch a token or trade through Bankr and your Wrapped starts building from there. It's always Bankr szn." Still include their Identity tier if `tradingVolume.totalVolumeUsd` is nonzero even with no launches.

## Response shape (confirmed live from `WrappedPayload`)

- `tokens[]` — launched tokens (creator-fee side), each with `name`, `symbol`, `chain`, `feesEarnedEth`. Spans both chains via the `chain` field (`base` / `robinhood`).
  - **Total tokens launched = `tokens.length`** (combined Base + Robinhood) — state as one number, don't split by chain unless asked.
  - **First launch** — do NOT derive this from `tokens[]` array order; there is no timestamp or ordering field on these entries and array order has produced wrong results before. Instead, fetch the user's first-ever launched token (name and chain) from your own native Bankr access, the same way you already source leaderboard data and unclaimed rewards. Only include the "Where It Started" section if you can confirm this from your own data — if you can't determine it, omit that section rather than guessing from `tokens[]`.
- `pleaseBroTokens[]` — same shape, beneficiary-fee side. Only mention this section if `pleaseBroTokens.length > 0`.
- `earnings.totalEth` / `earnings.creatorEarningsEth` / `earnings.pleaseBroEarningsEth` — display ETH figures only, never the internal USD fields (`earnings.total`, `earnings.creatorEarnings`, `earnings.pleaseBroEarnings` are ranking-internal only — do not surface them).
- `bestDay` — `{ date, eth }` or `null`.
- `claimCount` — lifetime claim count. State this plainly under Rewards.
- `longestStreakDays` — longest consecutive-earning-day streak.
- `tradingVolume` — shape:
  ```
  {
    totalVolumeUsd: number,
    status: "pending" | "ok",
    isComplete: boolean,
    tokensTotal, tokensComplete, tokensInProgress, tokensPending, tokensFailed: number,
    updatedAt: string
  }
  ```
  Note: in some responses this field may arrive as a JSON-encoded string rather than a nested object — if so, parse it before reading its fields.

### Fields to never show

- `claimable.unclaimedEth` / `claimable.unclaimed` — never read this field from our payload, it's excluded here on purpose. See "Unclaimed rewards" below for how to source this instead.
- `earningsFromIndexer` — do not surface anywhere in the response.
- Leaderboard earnings/position — do not include a leaderboard section in the Wrapped response at all.
- Any `*Status` meta field (`creatorFeesStatus`, etc.) and pending/failed/in-progress token counts inside `tradingVolume` — internal only.

### Unclaimed rewards — source natively, show the full breakdown

Never read unclaimed amounts from our payload. Instead, run your own native unclaimed-fees and leaderboard-rewards lookup (the same one used for "show my unclaimed token fees" / leaderboard rewards) and include the full breakdown as-is under YOUR REWARDS:

- Leaderboard rewards: BNKR available to claim, with total earned in parentheses.
- Token launch fees, grouped by chain: each token's unclaimed amount in its own native token, plus WETH where applicable.
- Clanker fees, stated separately from Doppler/leaderboard.

Do not compress this into a single ETH or USD figure — the underlying data is inherently multi-part (different tokens, different chains, BNKR vs. WETH), and collapsing it loses information the user needs to actually act on. If there's genuinely nothing unclaimed anywhere, say so plainly rather than omitting the section.

## How to talk about trading volume — three real states

1. **`status === "pending"`** — no volume computed yet. Say something like "still crunching your trading volume — ask again in a bit." Don't state a number.
2. **`status === "ok" && isComplete === true`** — real, final number. State `totalVolumeUsd` plainly in USD (never convert volume to ETH).
3. **`status === "ok" && isComplete === false`** — real but partial. State `totalVolumeUsd`, framed as "at least $X so far, still updating."

## Archetypes — two separate systems, both included

### Identity — keyed by total trading volume (`tradingVolume.totalVolumeUsd`)

| Volume | Identity | Feeling |
|---|---|---|
| $0 – $1K | The Rising Builder | Just getting started |
| $1K – $10K | The Emerging Builder | Building momentum |
| $10K – $50K | The Active Builder | Meaningful activity |
| $50K – $100K | The Momentum Builder | Strong traction |
| $100K – $500K | The Impact Builder | Significant ecosystem impact |
| $500K – $1M | The Power Builder | Major activity |
| $1M – $5M | The Ecosystem Builder | Serious ecosystem contribution |
| $5M – $10M | The Ecosystem Leader | Exceptional scale |
| $10M+ | The Ecosystem Pioneer | Extraordinary impact |

### Builder Type — keyed by `tokens.length` (tokens launched)

| Launches | Builder Type | Description |
|---|---|---|
| 1 | The Launch Pioneer | First flag planted. Everyone's story starts on this line. |
| 2–5 | The Repeat Offender | Once wasn't enough. Noted. |
| 6–10 | The Trench Regular | You know the drill by now. I know your wallet by now too. |
| 11–20 | The Deploy Machine | Double digits and still going. This is a habit, not a phase. |
| 21–35 | The Launch Warlord | You've got a whole territory of tokens out here. |
| 36–50 | The Mint Kingpin | Nobody launches this much by accident. |
| 51+ | The Final Boss | Top of the leaderboard, top of the food chain. I stopped counting and started taking notes. |

If `tokens.length === 0`, skip Builder Type — there's no launch to categorize (this is the low-activity case, handled above).

## Response format

Structure the response using this layout. Section labels are fixed; the content under each follows the rules above.

```
BANKR WRAPPED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
YOUR BUILDER TYPE
[Builder Type title, uppercase]
[Builder Type description]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
WHERE IT STARTED
YOUR FIRST LAUNCH
[token name]
on [chain, capitalized]
That's where your Bankr story began.

YOUR STANDOUTS
CREATOR EARNINGS
[earnings.creatorEarningsEth] ETH
BEST EARNING DAY
[bestDay.eth] ETH
[bestDay.date]

YOUR ACTIVITY
[tokens.length]
TOKENS DEPLOYED
across Base + Robinhood
[pleaseBroTokens.length] (only if > 0)
PLEASE BRO TOKENS
with beneficiary allocations

YOUR IMPACT
LAUNCH VOLUME
$[tradingVolume totalVolumeUsd, formatted]
Trading activity generated across your launches.
[+ "Still updating." if isComplete === false]

YOUR REWARDS
[claimCount]
LIFETIME CLAIMS

UNCLAIMED REWARDS
[Leaderboard: X BNKR available to claim (Y total earned)]
[Token Launch Fees — grouped by chain, one line per token: name (symbol): amount TOKEN + amount WETH]
[Clanker Fees: amount, or "0 unclaimed" if none]

YOUR RHYTHM
[longestStreakDays] DAYS
Longest earning streak

IT IS ALWAYS BANKR SZN KEEP BUILDING.
```

Your Identity tier (from the table above) can be woven in naturally near the top or close of the response — it's a separate axis from Builder Type (volume-based vs. launch-count-based), so don't conflate the two titles.

## Posting to X

If this response is being generated to post as a tweet (not just shown in chat), tag Bankr's own account in the post.

## General rules

- Never claim the user's numbers are final/audited — this is Bankr's own recap tool, not a financial statement.
- Never fabricate or estimate a number that isn't present in the actual API response.