# Cat Town Protocol Documentation

AI-readable reference for Cat Town — a Farcaster-native game world on Base. This doc is a higher-level companion to [SKILL.md](SKILL.md); for agent integration flows (trigger phrases, tx building, troubleshooting), start there.

- Game: https://cat.town
- Staking UI (Wealth & Whiskers Bank): https://cat.town/bank
- Public user docs: https://docs.cat.town
- Chain: Base mainnet (8453)

---

## Current coverage

This skill currently documents two Cat Town surfaces:

1. **KIBBLE staking** — the RevenueShare contract, stake/claim/unlock/unstake flows, staking leaderboard, user deposit history.
2. **World state** — the GameData contract, current season/time-of-day/weather/weekend.

Future revisions will add fishing (Isabella's weekend competition, Skipper's weekday fishing), fish raffle (Paulie, Friday 20:00 UTC draw), gacha (capsule pools), and the item / drop truth surface. Each will land under its own `references/<feature>/` subdirectory.

---

## KIBBLE token

| Property       | Value                                                       |
|----------------|-------------------------------------------------------------|
| Address (Base) | `0x64cc19A52f4D631eF5BE07947CABA14aE00c52Eb`                |
| Decimals       | 18                                                          |
| Total supply   | 1,000,000,000 (fixed)                                       |
| Burn sink      | `0x000000000000000000000000000000000000dEaD`                |

**Deflationary mechanic:** 2.5% of every fish identified is burned. The burn balance is already substantial (~66% at the last read). When quoting any "% of supply" stat, always compute circulating = `totalSupply − balanceOf(0xdEaD)`, not just `totalSupply`. SKILL.md's "KIBBLE circulating supply" section has the full formula and a concrete example.

---

## KIBBLE staking (RevenueShare)

| Property       | Value                                                       |
|----------------|-------------------------------------------------------------|
| Contract       | `0x9e1Ced3b5130EBfff428eE0Ff471e4Df5383C0a1` on Base        |
| Pattern        | Masterchef-style single-pool pro-rata                       |
| Reward token   | KIBBLE (in, out)                                            |
| Revenue sources | fishing (weekly, ≤12:00 UTC Mon), gacha (weekly, ≤12:00 UTC Wed) |
| Unlock wait    | **14 days** (`LOCK_PERIOD` = 1,209,600s, snapshotted per-user at `unlock()`) |

### The non-obvious bit — unit convention

`stake(uint256)` and `unstake(uint256)` take **integer KIBBLE** (not wei). The contract multiplies by `10^18` internally before calling `transferFrom`. `approve()` on KIBBLE is standard ERC-20 and takes wei. This asymmetry is the single most common integration failure on this contract — see the **⚠️ CRITICAL** section at the top of [SKILL.md](SKILL.md) before building any stake calldata.

### Exit flow

1. `unlock()` — sets `isUnlocking[user] = true`, writes `unlockEndTime[user] = now + LOCK_PERIOD`. User's stake is removed from `totalActiveStaked` → **pool share drops to 0%** → they stop accruing rewards. Tell the user this up front.
2. Wait until `block.timestamp >= unlockEndTime(user)` — 14 days.
3. `unstake(N)` — reverts if called before the wait ends. `N` is integer KIBBLE.

`relock()` cancels the wait and returns the user to the active pool at any point.

### Reads (all in integer KIBBLE, not wei)

- `getUserStaked(user)` — currently staked
- `pendingRewards(user)` — claimable right now
- `getPoolShareFraction(user) / 1e18 * 100` — user's current pool %
- `isUnlocking(user)` + `unlockEndTime(user)` — exit status + ETA
- `getTotalStaked()` / `getTotalActiveStaked()` — pool sizes

Full reference: [references/staking/contract.md](references/staking/contract.md).

### Off-chain API (public, unauthenticated)

- `GET https://api.cat.town/v2/revenue/staking/leaderboard` — top stakers with rank + pool-share %.
- `GET https://api.cat.town/v2/revenue/deposits/{address}` — one user's historical fishing/gacha deposits with per-tx share.

Response shapes + field meanings: [references/staking/api.md](references/staking/api.md).

---

## World state (GameData)

| Property       | Value                                                       |
|----------------|-------------------------------------------------------------|
| Contract       | `0x298c0d412b95c8fc9a23FEA1E4d07A69CA3E7C34` on Base        |
| Reads          | `getGameState()` returns `(season, timeOfDay, isWeekend, worldEvent, weather)` |
| Granularity    | Live, updates continuously; reads are cheap                  |

Enums: Season `0..3` (Spring/Summer/Autumn/Winter); TimeOfDay string (`"Morning"`, `"Daytime"`, `"Evening"`, `"Nighttime"`); Weather `0..6` (None/Sun/Rain/Wind/Storm/Snow/Heatwave).

World state drives fishing and gacha drop tables (different fish appear in different weather/seasons). Item-level drop data is out of scope for this revision.

Full function table, selectors, live sample: [references/world/contract.md](references/world/contract.md).

---

## Weekly cadence

Cat Town runs on a fixed weekly UTC cycle. Only the **bold** rows directly affect staking rewards; the rest is context for future skill surfaces.

| Day       | Event                             | Time                       | Host              |
|-----------|-----------------------------------|----------------------------|-------------------|
| Monday    | **Fishing revenue deposit**       | by 12:00 (often earlier)   | Theodore / Cassie |
| Mon–Fri   | Fish raffle ticket sales open     | —                          | Paulie            |
| Mon–Fri   | Weekday fishing                   | —                          | Skipper           |
| Wednesday | **Gacha revenue deposit**         | by 12:00 (often earlier)   | Theodore / Cassie |
| Friday    | **Fish raffle draw**              | 20:00                      | Paulie            |
| Sat–Sun   | **Weekly fishing competition**    | Sat morning → Sun night    | Isabella          |

Full calendar with revenue-split details and NPC cheat-sheet: [references/world/calendar.md](references/world/calendar.md).

---

## Not covered yet

Cat Town's codebase exposes additional public surfaces (item catalog with drop conditions, gacha/boutique item pools, fishing catch tables, seasonal events via `/v1/seasonal/*`, on-chain leaderboards) that are out of scope for this revision. When they're added, each will land in a new `references/<feature>/` subdirectory without disturbing existing integrations.
