# Cat Town Protocol Documentation

AI-readable reference for Cat Town — a Farcaster-native game world on Base. This doc is a higher-level companion to [SKILL.md](SKILL.md); for agent integration flows (trigger phrases, tx building, troubleshooting), start there.

- Game: https://cat.town
- Staking UI (Wealth & Whiskers Bank): https://cat.town/bank
- Public user docs: https://docs.cat.town
- Chain: Base mainnet (8453)

---

## Current coverage

This skill currently documents six Cat Town surfaces:

1. **KIBBLE staking** — the RevenueShare contract, stake/claim/unlock/unstake flows, staking leaderboard, user deposit history.
2. **World state** — the GameData contract, current season/time-of-day/weather/weekend.
3. **Fishing drops** — the public item-truth catalog with world-state-conditioned drops (weather, season, time of day), plus the frontend's exact fishing filter.
4. **Fishing competition** — weekly Sat–Mon competition with live prize-pool math (10/80/10 split) and top-10 leaderboard.
5. **Boutique** — daily 3-item onchain shop with seasonal pools, plus the KIBBLE→USD price oracle.
6. **KIBBLE tokenomics** — Jasper's answers: % staked, % burned, live staking APY.

Future revisions will add the fish raffle (Paulie's Friday 20:00 UTC draw), gacha capsule pools, the boutique purchase flow, and the community-pot surface Jasper also touches. Each will land under its own `references/<feature>/` subdirectory.

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

## Fishing drops (item catalog + world filter)

| Property       | Value                                                       |
|----------------|-------------------------------------------------------------|
| Endpoint       | `GET https://api.cat.town/v2/items/master?limit=1000`       |
| Auth           | Public (no headers)                                         |
| Catalog size   | ~430 active items                                           |
| Caching        | Safe to cache ≥1 hour (frontend caches indefinitely)        |

Each item carries optional `dropConditions` keyed by `events`, `seasons`, `timesOfDay`, `weathers`. The frontend's fishing filter keeps only `source=Fishing` + `itemType ∈ {Fish, Treasure}`, matches the requested axis, drops event-exclusive items unless the event is active, and sorts by rarity DESC → name ASC. This returns items **exclusive** to that axis value (e.g. 3 snow-only drops, not 400+ weather-agnostic items).

Weather changes most frequently (minutes-to-hours), so weather-exclusive drops are the most rotational — highest-value thing to surface.

Full recipe + live weather→drops table: [references/fishing/drops.md](references/fishing/drops.md).

---

## Boutique (daily rotation, onchain)

| Property        | Value                                                       |
|-----------------|-------------------------------------------------------------|
| Contract        | `0xf9843bF01ae7EF5203fc49C39E4868C7D0ca7a02` on Base        |
| KIBBLE Oracle   | `0xE97B7ab01837A4CbF8C332181A2048EEE4033FB7`                |
| Rotation cycle  | Every 00:00 UTC, 3 items from current season's pool         |
| Primary read    | `getTodaysRotationDetails() → ShopItemView[]`               |
| Pricing         | `price` in KIBBLE wei; convert to USD via oracle            |

Seasonal doc pages (public): [shops/boutique](https://docs.cat.town/shops/boutique), [spring-fashion](https://docs.cat.town/boutique/spring-fashion), [summer-fashion](https://docs.cat.town/boutique/summer-fashion), [autumn-fashion](https://docs.cat.town/boutique/autumn-fashion), [winter-fashion](https://docs.cat.town/boutique/winter-fashion).

**USD conversion:** `getKibbleUsdPrice()` returns USD-per-KIBBLE scaled by **`10^18`** (note: `getEthUsdPrice()` on the same contract uses `10^8`). Formula: `usd = (price_wei * rawKibbleUsdPrice) / 10^36`. Live at time of writing: ~$0.0009487 per KIBBLE.

Full reference: [references/boutique/contract.md](references/boutique/contract.md).

---

## Fishing competition (weekly, Sat 00:00 UTC → Mon 00:00 UTC)

| Property       | Value                                                       |
|----------------|-------------------------------------------------------------|
| Contract       | `0x62a8F851AEB7d333e07445E59457eD150CEE2B7a` on Base        |
| Leaderboard API | `GET https://api.cat.town/v1/fishing/competition/leaderboard` (public) |
| Cycle          | Saturday 00:00 UTC → Monday 00:00 UTC (48h window)          |
| Host NPC       | Isabella                                                    |

Prize-pool math (mirroring the frontend exactly):

```
prizePool                             // API field: total volume of KIBBLE spent on fish IDs during comp
leaderboardShare = prizePool * 0.10   // top-10 prize pool, further split 30/20/10/8/8/7/5/4/4/4
treasureShare    = prizePool * 0.80   // returned to fishers as treasures
stakersRevenue   = prizePool * 0.10   // flows to KIBBLE stakers via RevenueShare
```

When active: lead with running time / weather / participants / prize pool / top 10. When inactive: compute next Saturday 00:00 UTC, offer a reminder, and offer to narrate the last completed competition (the API returns it when `isActive=false`).

Full reference: [references/fishing/competition.md](references/fishing/competition.md).

---

## KIBBLE tokenomics

| Property   | Value                                                              |
|------------|--------------------------------------------------------------------|
| Inputs     | `balanceOf(0xdEaD)`, `RevenueShare.getTotalStaked()`, baronbot's 30-day revenue-share history |
| % burned   | `balanceOf(0xdEaD) / totalSupply` × 100 (live: ~66%)               |
| % staked   | `totalStaked / (totalSupply − burned)` × 100 (live: ~24%)          |
| Staking APY | Derived from baronbot's 30-day deposits + stake (live: ~30%)       |

Mirrors Jasper's NPC answers in the Wealth & Whiskers Bank. The % burned uses total supply as the denominator; % staked uses circulating (total − burned). APY is dynamic and uncapped until 1000% APY / 50% monthly rate sanity limits.

Full reference: [references/kibble/tokenomics.md](references/kibble/tokenomics.md).

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

Cat Town's codebase exposes additional public surfaces (gacha/boutique item pools, fishing competition leaderboard, fish raffle entry flow, seasonal events via `/v1/seasonal/*`, daily rewards) that are out of scope for this revision. When they're added, each will land in a new `references/<feature>/` subdirectory without disturbing existing integrations.
