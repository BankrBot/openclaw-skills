---
name: cattown
description: Interact with Cat Town — a Farcaster-native game world on Base. Currently covers KIBBLE staking via the RevenueShare contract (stake, claim, claim-and-restake, unlock, relock, unstake), the staking leaderboard, and a user's revenue-deposit history. Use when the user mentions Cat Town, KIBBLE, the Wealth & Whiskers bank, staking rewards, RevenueShare, fishing revenue, gacha revenue, the staking leaderboard, or the weekly fishing-competition / fish-raffle schedule. More Cat Town surfaces (fish raffle, fishing competition) will be added here over time.
---

# Cat Town — Agent Overview

Cat Town is a Farcaster-native game world on Base. Players fish, collect, and earn KIBBLE; a share of town revenue is streamed weekly to KIBBLE stakers. This skill lets agents read Cat Town state and submit the transactions needed to participate.

The town's NPCs run each activity and are worth naming when talking to players:

- **Wealth & Whiskers Bank** — where KIBBLE staking happens. **Theodore** works the day shift, **Cassie** takes over in the evening.
- **Paulie** — runs the weekly fish raffle.
- **Skipper** — the weekday fishing NPC.
- **Isabella** — hosts the weekend fishing competition.

Current coverage:

- KIBBLE staking via the **RevenueShare** contract — stake, claim, claim-and-restake, unlock, relock, unstake.
- The staking leaderboard and a user's deposit history (public unauthenticated JSON API).
- The weekly event calendar (fishing revenue, gacha revenue, fishing competition, fish raffle).

This SKILL.md will grow as more Cat Town surfaces (fish raffle entries, fishing-competition reads) are added. The calendar here is the shared reference — expect future sections to point back at it.

Links:
- Game: https://cat.town
- Bank (staking UI): https://cat.town/bank
- Docs: https://docs.cat.town

---

## Weekly Calendar (all times UTC)

Cat Town runs on a fixed weekly cadence. Use these timings when setting user expectations ("your next fishing drop is Monday") or scheduling follow-ups.

| Day       | Event                             | Time                       | Host              | Affects staking rewards? |
|-----------|-----------------------------------|----------------------------|-------------------|--------------------------|
| Monday    | **Fishing revenue deposit**       | by 12:00 (often earlier)   | Theodore / Cassie | Yes                      |
| Mon–Fri   | Fish raffle ticket sales open     | —                          | Paulie            | No                       |
| Mon–Fri   | Weekday fishing                   | —                          | Skipper           | No                       |
| Wednesday | **Gacha revenue deposit**         | by 12:00 (often earlier)   | Theodore / Cassie | Yes                      |
| Friday    | **Fish raffle draw**              | 20:00                      | Paulie            | No                       |
| Sat–Sun   | **Weekly fishing competition**    | Sat morning → Sun night    | Isabella          | Indirect*                |

*During the weekend fishing competition (Sat–Sun), 10% of every fish identification feeds the KIBBLE stakers pool. Weekday fishing (Skipper) does **not** feed stakers. This is why weekend activity sizes the following Monday's fishing-revenue deposit. See [references/world/calendar.md](references/world/calendar.md) for the full revenue split.

Deposits are triggered by the Cat Town backend calling `depositRevenue(amount, source)` on RevenueShare, with `source` in `"fishing"` or `"gacha"`. Watch the `RevenueDeposited(string source, uint256 depositTimestamp, uint256 depositAmount, uint256 newAccRewardPerShare)` event to know the exact moment a drop lands.

---

## ⚠️ CRITICAL: stake/unstake take INTEGER KIBBLE, not wei — read this first

This contract breaks the 99%-of-ERC-20 default. If you reflexively wei-encode the stake/unstake amount because "that's how tokens work," the tx reverts. This is the single failure mode you will hit on this contract. Stop here and internalize the table before touching any write path.

| Call                                      | Amount unit               | Example for 1 KIBBLE              |
|-------------------------------------------|---------------------------|-----------------------------------|
| `kibble.approve(revenueShare, …)`         | **wei** (standard ERC-20) | `1000000000000000000` (= 1 × 10¹⁸) |
| `revenueShare.stake(uint256 amount)`      | **integer KIBBLE**        | `1`                               |
| `revenueShare.unstake(uint256 amount)`    | **integer KIBBLE**        | `1`                               |

Reads are also integer KIBBLE: `getUserStaked`, `pendingRewards`, `getTotalStaked`, `getTotalActiveStaked`.

### Raw calldata — right vs. wrong

```
✅ stake(1)     → 0xa694fc3a0000000000000000000000000000000000000000000000000000000000000001
❌ stake(1e18)  → 0xa694fc3a0000000000000000000000000000000000000000000000000de0b6b3a7640000
```

The second form reverts with `ERC20: transfer amount exceeds balance` because the contract multiplies your argument by `10^18` internally, turning `1e18` into `1e36` wei. Verified via simulation against the deployed contract on Base.

### Pre-submit validation (run this before every stake/unstake)

- Is the amount `< 1,000,000`? → probably correct (integer KIBBLE).
- Is the amount `≥ 10^15`? → almost certainly wrong — you wei-encoded by reflex.
- Sanity check: `stake(1)` = 1 KIBBLE. `stake(100)` = 100 KIBBLE. `stake(10000)` = 10,000 KIBBLE.
- `approve` is the OPPOSITE — it is wei. Staking `N` KIBBLE requires `approve(revenueShare, N * 10^18)`.

**Signer = holder.** The address that signs `stake` must be the same address that holds the KIBBLE and signed the `approve`.

---

## KIBBLE Staking

### Addresses (Base, chain id 8453)

- **RevenueShare**: `0x9e1Ced3b5130EBfff428eE0Ff471e4Df5383C0a1`
- **KIBBLE token (ERC-20, 18 decimals)**: `0x64cc19A52f4D631eF5BE07947CABA14aE00c52Eb`

Base Sepolia addresses and the full ABI surface are in [references/staking/contract.md](references/staking/contract.md).

### Core flows

Single pool, single reward token — KIBBLE in, KIBBLE out. No reward-token selection, no per-user lock duration, no multipliers. One global `accRewardPerShare` accumulator updated on each `depositRevenue`.

**1. Stake** (mixed units — re-read the CRITICAL section above if uncertain)
1. `kibble.approve(revenueShare, amount_wei)` — `amount_wei = N * 10^18` where `N` is the KIBBLE count. Required once if `allowance(user, revenueShare) < amount_wei`.
2. `revenueShare.stake(uint256 N)` — **`N` is the integer KIBBLE count, NOT wei.** If this reverts with `ERC20: transfer amount exceeds balance`, you wei-encoded — pass the plain integer instead. Emits `Staked(user, amount)`.

**2. Claim** (after each fishing/gacha deposit)
- `revenueShare.claim()` — transfers `pendingRewards(user)` to the user. Emits `Claimed(user, amount)`.
- `revenueShare.claimAndRestake()` — claims and auto-adds to the user's stake in one tx. Emits `ClaimedAndRestaked(user, restakedAmount, totalStakedNow)`.

**3. Exit (unlock → wait → unstake)**
1. `revenueShare.unlock()` — emits `UnlockInitiated(user, unlockEndTime)`. Sets `isUnlocking[user] = true`. **Always tell the user two things when they unlock:** (a) the wait is **14 days** (`LOCK_PERIOD` = 1,209,600 seconds, snapshotted so later changes don't affect them), and (b) their pool share just dropped from whatever-it-was to **0%** — they won't earn fishing or gacha deposits during the wait. Read the pre-unlock share first via `getPoolShareFraction(user) / 1e18 * 100`.
2. Wait until `block.timestamp >= unlockEndTime(user)`. The 14-day value is safe to quote at the point of unlock. Read `LOCK_PERIOD()` live only if you want defensive protection against future upgrades (the contract is UUPS-upgradeable).
3. `revenueShare.unstake(uint256 N)` — **`N` is the integer KIBBLE count, same convention as stake.** Reverts before the wait ends. Emits `Unstaked(user, amount)`.
- `revenueShare.relock()` — at any time during the wait, cancels the unlock and puts the user back into the earning pool. Emits `Relocked(user, amount)`.

#### Checking remaining unlock time

When a user asks "how long until I can withdraw?", compute from `unlockEndTime(user)`:

```
remaining_seconds = max(0, unlockEndTime(user) - current_unix_time)
```

- `isUnlocking(user) == false` → not unlocking, nothing to wait on.
- `remaining_seconds > 0` → still waiting. Convert to days/hours for the reply.
- `remaining_seconds == 0` → `unstake(N)` is callable now.

No dedicated contract method for "time left" — just subtract. Use the latest block's timestamp if you want to avoid clock-skew with the user's device.

#### Mapping "unstake" / "withdraw" / "exit" to the right call

Users say "unstake" colloquially to mean the whole exit, not literally the onchain `unstake()` function. Before acting, read three values: `isUnlocking(user)`, `unlockEndTime(user)`, and the user's current pool share (`getPoolShareFraction(user) / 1e18 * 100` as a percentage). Then route:

| State                                                    | What to call | What to tell the user                                                                 |
|----------------------------------------------------------|--------------|---------------------------------------------------------------------------------------|
| `isUnlocking(user) == false`                             | `unlock()`   | "Started your unlock. Wait is **14 days** — ready at `<unlockEndTime>`. Your pool share just dropped from **Y%** to **0%**; you won't earn revenue deposits during the wait. Call `relock()` any time to cancel and restore your share." |
| `isUnlocking == true` **and** `now < unlockEndTime`      | *(no tx)*    | "Already unlocking. ~X days Y hours left until you can withdraw. Your pool share is **0%** until you either `unstake()` after the wait or `relock()` now."                                                  |
| `isUnlocking == true` **and** `now >= unlockEndTime`     | `unstake(N)` | "Withdrew N KIBBLE." (Or remaining balance if partial.)                                |

Same routing for "withdraw," "exit," "pull my KIBBLE out," "get my stake back." **Never call the onchain `unstake()` as the first step** — it reverts unless the user has already completed an unlock wait.

Why the share drop matters: while `isUnlocking == true`, the user's stake is **removed from `totalActiveStaked`**, so they do not earn any fishing or gacha revenue deposits that land during the 14-day wait. Surfacing the pre-unlock share (Y%) makes the opportunity cost explicit.

### Unlock state machine — the gotcha to warn users about

```
 [staking, earning] ──unlock()──▶ [unlocking, NOT earning] ──wait LOCK_PERIOD──▶ [unstake available]
         ▲                               │                                              │
         └────────── relock() ───────────┘                                              │
         │                                                                              │
         └────────────────────── unstake(amount) ◀──────────────────────────────────────┘
```

While `isUnlocking[user] == true`:
- The user's balance is in `totalStaked()` but **excluded from `totalActiveStaked()`**.
- Reward math divides by `totalActiveStaked`, so the user **does not accrue rewards** during the unlock window.
- `unstake()` reverts until `unlockEndTime(user)` has passed.

Recommend users `claim()` any pending rewards first, then `unlock()`, then `unstake()` once the wait is over. If they change their mind mid-wait, `relock()` is free and returns them to the earning pool instantly.

### Reading a user's position

KIBBLE-denominated reads return **whole KIBBLE** (not wei). See the Amount units section above.

| Call                               | Returns / unit                                     | Meaning                                                            |
|------------------------------------|----------------------------------------------------|--------------------------------------------------------------------|
| `getUserStaked(address)`           | whole KIBBLE                                       | Currently staked KIBBLE                                            |
| `pendingRewards(address)`          | whole KIBBLE                                       | Claimable KIBBLE right now                                         |
| `isUnlocking(address)`             | `bool`                                             | True if user has called `unlock()` and not yet unstaked/relocked   |
| `unlockStartTime(address)`         | unix seconds                                       | When `unlock()` was called                                         |
| `unlockEndTime(address)`           | unix seconds                                       | When `unstake()` becomes callable                                  |
| `getPoolShareFraction(address)`    | fraction × 1e18                                    | User's share of the active pool                                    |
| `getTotalActiveStaked()`           | whole KIBBLE                                       | Total KIBBLE earning rewards right now                             |
| `getTotalStaked()`                 | whole KIBBLE                                       | Total KIBBLE in the contract (includes unlocking users)            |
| `LOCK_PERIOD()`                    | seconds                                            | Unlock wait duration                                               |
| `accRewardPerShare()`              | accumulator × 1e18                                 | Global reward accumulator                                          |

Full function-by-function reference: [references/staking/contract.md](references/staking/contract.md).

### KIBBLE circulating supply — always subtract the burn address

When quoting "what % of KIBBLE is staked" (or any % of supply), compute against **circulating supply**, not `totalSupply`. KIBBLE has a deflationary burn mechanic: 2.5% of every fish identified is sent to `0x000000000000000000000000000000000000dEaD`, and this compounds. The burned portion is already substantial — dividing by `totalSupply` materially undercounts the staked share (typically by ~3×).

```
totalSupply       = 1,000,000,000 KIBBLE                         // fixed, read via totalSupply() on KIBBLE
burned            = balanceOf(0x000000000000000000000000000000000000dEaD) on KIBBLE   // read live
circulating       = totalSupply − burned
percentStaked     = getTotalStaked() / circulating × 100          // reads are whole-KIBBLE integers
```

Representative recent values (re-read live — the burn keeps growing):

- `totalSupply` ≈ 1,000,000,000 KIBBLE
- `balanceOf(0xdEaD)` ≈ 663M KIBBLE burned (~66%)
- circulating ≈ 337M KIBBLE
- `getTotalStaked()` ≈ 81M KIBBLE → **~24% of circulating KIBBLE is staked**

`balanceOf(0x0)` on KIBBLE is `0`; the protocol burns to `0xdEaD` only. If you must be exhaustive, check both, but `0xdEaD` is where the number lives.

### Staking leaderboard & user deposit history

Two public JSON endpoints on `https://api.cat.town`, **no auth required**. Use these whenever the user wants their rank, their share of the pool, or their weekly earnings history without paying RPC costs.

- `GET /v2/revenue/staking/leaderboard` — ranked stakers with stake amount and pool-share %.
- `GET /v2/revenue/deposits/{address}` — one user's historical `fishing` / `gacha` deposits, per-tx amounts, and the share that landed for that user.

Full shapes, field meanings, and example responses: [references/staking/api.md](references/staking/api.md).

---

## World state

Cat Town's live world state (season, time of day, weather, weekend flag) lives on a single onchain contract — **GameData** at `0x298c0d412b95c8fc9a23FEA1E4d07A69CA3E7C34` on Base. Fully read-only from an agent's perspective.

The one call you usually want is **`getGameState()`** → `(season, timeOfDay, isWeekend, worldEvent, weather)`. One RPC, every field:

- **Season** (`uint8`): `0=Spring`, `1=Summer`, `2=Autumn`, `3=Winter`
- **TimeOfDay** (`string`): `"Morning"`, `"Daytime"`, `"Evening"`, `"Nighttime"`
- **Weather** (`uint8`): `0=None`, `1=Sun`, `2=Rain`, `3=Wind`, `4=Storm`, `5=Snow`, `6=Heatwave`
- **isWeekend** (`bool`): true on Sat/Sun UTC (the fishing-competition window)
- **worldEvent** (`uint8`): event code — detailed event decoding is out of scope for this skill revision

World state drives fishing and gacha drop tables — different fish appear in different weather/seasons — but item-level drop tables are also out of scope for this revision.

Full function table, selectors, raw calldata, live sample response, and historical-lookup fns (`getSeasonForDate`, `getWeatherForDate`): [references/world/contract.md](references/world/contract.md).

For the fixed weekly cadence (fishing/gacha revenue deposits, Paulie's raffle, Isabella's weekend competition), see [references/world/calendar.md](references/world/calendar.md).

---

## Fishing drops — "what can I catch in this weather?"

When a user asks "what's catchable in the rain?", "what's exclusive to Winter evenings?", or "what drops in a Storm?", combine live world state (from GameData above) with Cat Town's public item catalog:

```
GET https://api.cat.town/v2/items/master?limit=1000        // public, no auth
```

Each item has optional `dropConditions: { events?, seasons?, timesOfDay?, weathers? }`. The frontend's fishing filter (ported verbatim from `utils/helpers/fishingHelpers.tsx`) is four steps:

1. Keep only `isActive == true`, `source == "Fishing"`, `itemType ∈ {"Fish", "Treasure"}`.
2. Match the user-asked axis — `weathers` / `seasons` / `timesOfDay` — including `axis_value` in the item's condition array.
3. Drop items that require a seasonal event unless that event is currently active (Halloween items are invisible outside Halloween).
4. Sort by rarity DESC, then name ASC.

**This returns items *exclusive* to that axis value.** `getFishingItemsForWeather("Snow")` → 3 snow-only drops, not the 400+ weather-agnostic items. That matches how the frontend surfaces "special drops this weather."

**Enum mismatch to normalize:** GameData contract returns `timeOfDay` as `"Daytime"` / `"Nighttime"`; the item API uses `"Afternoon"` / `"Night"`. Weather and season strings match (after lowercasing).

Live example — weather=Storm: Misty Duck (Rare), Lovely Duck (Rare), King Snapper (Rare Fish), **Elusive Marlin (Legendary Fish)**. Weather is the most rotational axis (minutes-to-hours), so weather-exclusive drops are the highest-value thing to surface to a user deciding *when* to fish.

### Response pattern — lead with big-ticket specials, then offer the standard drops

When a user asks "what can I catch today / right now?", listing only the 3-4 axis-exclusive items feels incomplete. Answer in two tiers. Within each tier, lead with the **big-ticket items** so the reply opens with the most interesting catches.

#### Big-ticket sort (apply to every list you surface)

1. **Rarity DESC** — Legendary → Epic → Rare → Uncommon → Common. This is the primary signal for fish (weight data isn't in the item API — see below).
2. **`sellValue` DESC** — useful tiebreaker within a rarity. `sellValue` is in **cents USD** (not KIBBLE). Real examples from the catalog: Legendary time-of-day rings (Solar, Dawnbreak, Moonlight, Twilight) sell at 25,000¢ = $250; Diamond and Frozen Tusk at 10,000¢ = $100; Gilded Sundial at 5,500¢.
3. Name ASC as final tiebreaker.

#### Two tiers

1. **Lead with the special drops** — weather-exclusive and timeOfDay-exclusive items for the current state. Sort with the big-ticket order above — the Legendary goes first in the reply, not last.
2. **Count the "standard drops" also catchable today** — items with NO `weathers` and NO `timesOfDay` conditions, whose season + event gates still pass. Baseline is ~26 per season.
3. **Offer the deep dive.** End with a prompt like: *"There are X other standard drops you can also catch today — want me to list them?"*

Concrete filter for standard drops (note: "standard" = not rotating on weather/time, as opposed to "special" — has nothing to do with the `Common` *rarity* tier):

```
standard_drops(current_season, current_event):
  for item in catalog:
    require item.isActive
    require item.source == "Fishing"
    require item.itemType in {"Fish", "Treasure"}
    require item.dropConditions has no `weathers` array
    require item.dropConditions has no `timesOfDay` array
    if item.dropConditions.seasons is set:
      require current_season in item.dropConditions.seasons
    if item.dropConditions.events is set:
      require current_event in item.dropConditions.events
```

Example reply for Storm / Spring / no active event — note Legendary leads:

> Storm weather right now brings out 4 special drops, headed by **Elusive Marlin** (Legendary Fish). The rest: **King Snapper** (Rare Fish), **Misty Duck** (Rare Treasure), **Lovely Duck** (Rare Treasure).
>
> You can also catch **~26 other standard Spring drops** today, led by **Alligator Gar** (Legendary Fish), **Diamond** ($100 Epic Treasure), and **Jade Figurine** ($40 Epic). Want me to list the rest?

#### Fish weight data — not in the API, cross-reference the public docs

Per-species fish weight ranges are **not** returned by `/v2/items/master`. If a user asks about the heaviest fish or typical weights, cross-reference Cat Town's public docs (unauthenticated, human-readable):

- Fish weights + conditions: https://docs.cat.town/items/fishing/fish
- Treasure details: https://docs.cat.town/items/fishing/treasures

For quick programmatic answers, lean on rarity + `sellValue`. For "what's the biggest {species}", point the user at those docs pages.

Full recipe, complete weather→drops table, and live-sweep counts: [references/fishing/drops.md](references/fishing/drops.md).

---

## Fishing competition (weekly, Isabella hosts)

The **FishingCompetition** contract at `0x62a8F851AEB7d333e07445E59457eD150CEE2B7a` (Base) runs a weekly competition **Saturday 00:00 UTC → Monday 00:00 UTC**. When a user asks about it, **lead with live data, not with generic rules.** The skeleton differs based on whether one is currently running.

### Is one running?

- Onchain: `isCompetitionActive()` → `(bool active, bytes32 eventId)`
- API (public, no auth): `competition.isActive` in `GET https://api.cat.town/v1/fishing/competition/leaderboard`

### Prize-pool math (mirror the frontend exactly)

The API's `prizePool` is **total volume** (all KIBBLE spent identifying fish during the competition). The frontend splits it three ways:

```
prizePool                             // total volume
leaderboardShare = prizePool * 0.10   // top-10 prize pool ("Prize Pool" in UI)
treasureShare    = prizePool * 0.80   // treasures returned to fishers
stakersRevenue   = prizePool * 0.10   // flows to KIBBLE stakers via RevenueShare
```

Top-10 distribution of `leaderboardShare` (from `fishingLeaderboardShareForRank`): **30%, 20%, 10%, 8%, 8%, 7%, 5%, 4%, 4%, 4%**. `Math.floor` to whole KIBBLE.

### If active — response pattern

Pull the API response once, then pick 3–5 of these to feature (keep it conversational, don't dump everything):

- **Running time** — `now - startTime` ("14 hours in, 34 hours to go")
- **Weather** — from `GameData.getGameState()` (drives which special fish appear)
- **Participants** — `totalPlayers`
- **Leaderboard prize pool** — `prizePool * 0.10` in KIBBLE **+ USD conversion** via the oracle
- **Treasures returned to players** — `prizePool * 0.80`
- **Stakers revenue generated** — `prizePool * 0.10`
- **Top 10** — rank, basename (or short addr), fishName (+ shiny flag), weight in kg, expected payout

### If NOT active — response pattern

1. Say it clearly: "No fishing competition is running right now."
2. Compute next start = **next Saturday 00:00 UTC**; express as "starts in X days Y hours."
3. **Offer a reminder**: "Want me to ping you when it kicks off?"
4. **Ask the follow-up**: "Do you want to hear about last week's competition?"
5. If the user says yes, the same API response (even when inactive) carries the most recent completed competition — narrate winner, top-3 prizes, total volume, total participants.

### Example reply — inactive with offer

> There's no fishing competition running right now. The next one starts **Saturday 00:00 UTC — about 2 days 14 hours away**.
>
> Want me to ping you when it kicks off? I can also tell you about **last weekend's competition** — 100 fishers, **3.06M KIBBLE total volume**, and **bitcoinbov.base.eth won** with a 46.36 kg Elusive Marlin (~91,700 KIBBLE, ~$87).

### Example reply — active, leading with live data

> Fishing competition is live — **12 hours in, 36 hours to go**. Weather's **Storm** 🌧️ (Elusive Marlin's biting).
>
> - **27 fishers** competing
> - **Leaderboard prize pool**: ~41,200 KIBBLE (~$39) — 1st takes 30% (~12,360 KIBBLE)
> - Currently leading: **alice.base.eth** with a 42.8 kg Alligator Gar
> - Also generating **~33k KIBBLE for KIBBLE stakers** and **~264k returned to fishers as treasures** this weekend
>
> Want the full top 10?

Full ABI surface, per-rank payout worked example at current oracle rate, and the complete leaderboard response shape: [references/fishing/competition.md](references/fishing/competition.md).

---

## Boutique — daily 3-item shop

The boutique is a fully onchain daily shop. Every day at **00:00 UTC** the Boutique contract surfaces **3 items** deterministically selected from the current season's pool. No off-chain API — all state is readable directly on Base.

### Addresses

- **Boutique**: `0xf9843bF01ae7EF5203fc49C39E4868C7D0ca7a02`
- **Kibble Price Oracle** (for USD conversion): `0xE97B7ab01837A4CbF8C332181A2048EEE4033FB7`

### Primary read — `getTodaysRotationDetails()`

Single call returns today's 3 items as `ShopItemView[]`. Each item carries `price` (in KIBBLE **wei**, divide by `10^18`), `stockRemaining`, `maxSupply`, `isPurchasableNow`, and a `traitNames`/`traitValues` parallel pair that encodes Name, Rarity, Slot, Image. Parse those into a dict to render.

### KIBBLE → USD conversion (the game UI doesn't do this — we should)

The in-game boutique shows KIBBLE prices only. To give users a USD readout, read the Kibble Price Oracle:

- `getKibbleUsdPrice()` → `uint256` USD per 1 KIBBLE, scaled by **`10^18`** (not 1e8 — **don't confuse with `getEthUsdPrice()` which is `10^8` Chainlink style**).
- Formula: `usd_value = (price_wei * rawKibbleUsdPrice) / 10^36`
- Live example: raw = `948,723,424,083,878` → **$0.0009487 per KIBBLE** → 10,000 KIBBLE ≈ **$9.49**.

### Response pattern — "what's in the boutique today?"

1. Parallel reads: `getTodaysRotationDetails()` + `getKibbleUsdPrice()`.
2. For each of the 3 items: parse the trait arrays (Name/Rarity/Slot), compute KIBBLE and USD price, check stock.
3. Sort big-ticket first — **rarity DESC** (Legendary → Common), then **KIBBLE price DESC**, then name ASC.
4. Flag `stockRemaining == 0` as "Sold Out"; otherwise show `"X / maxSupply remaining"`.
5. Open the reply with the current season; close with the matching `docs.cat.town/boutique/…-fashion` link for fuller context.

The collection name (e.g. `"Spring Fashion"`) is on the item itself as the **`Collection`** trait — surface it at the top of the reply so the user knows which collection is currently rotating.

Example reply (real data from today's rotation):

> **Boutique today — Spring Fashion collection:**
>
> 1. **White Longsleeve** — Rare Body — **12,500 KIBBLE (~$11.86)** — 1 / 1 remaining
> 2. **Royal Blue Varsity** — Uncommon Body — **6,000 KIBBLE (~$5.69)** — 2 / 2 remaining
> 3. **Classic Academic Blouse** — Uncommon Body — **6,000 KIBBLE (~$5.69)** — 1 / 2 remaining
>
> Browse the other seasonal collections:
> - Spring: https://docs.cat.town/boutique/spring-fashion
> - Summer: https://docs.cat.town/boutique/summer-fashion
> - Autumn: https://docs.cat.town/boutique/autumn-fashion
> - Winter: https://docs.cat.town/boutique/winter-fashion
> - Overview: https://docs.cat.town/shops/boutique

Include all four season links in every response — a user interested in the current collection will often want to peek at others.

Full ABI surface, trait schema (real keys: `Item Name`, `Rarity`, `Item Type`, `Source`, `Slot`, `Sprite`, `imageUrl`, `Collection`, etc.), preview future rotations, and the complete oracle math: [references/boutique/contract.md](references/boutique/contract.md).

**Purchase flow is out of scope for this revision** — this skill currently reads the boutique only.

---

## KIBBLE tokenomics (Jasper's answers)

When a user asks about KIBBLE — "how much is staked?", "how much burned?", "what's the APY?" — mirror the numbers the NPC **Jasper** quotes at the Wealth & Whiskers Bank. Three headline stats, each from live reads:

### % Burned (of TOTAL supply)

```
burnedPercent = balanceOf(0xdEaD on KIBBLE) / 1,000,000,000 × 100
```

Denominator is total supply (1B), not circulating — that's how Jasper phrases it. **Live at time of writing: ~66.3% of supply already burned.**

### % Staked (of CIRCULATING supply)

```
circulating   = totalSupply − balanceOf(0xdEaD)
stakedPercent = RevenueShare.getTotalStaked() / circulating × 100
```

Denominator is **circulating** (total minus burned), so users get a realistic number after the deflationary burn. **Live at time of writing: ~24.0% of circulating KIBBLE is staked.**

### Staking APY at Wealth & Whiskers

Derived dynamically from **baronbot** (`0x8Ff7AcCCf73c515c1f62Fc7b64A63F17Ce99659e`, rank-1 continuous staker) because the return per KIBBLE is the same for every active staker. Formula:

```
1. GET /v2/revenue/deposits/<baronbot> — keep last 30 days of deposits
2. monthly_revenue = period_revenue * (30 / days_since_first_deposit)
3. monthly_rate    = monthly_revenue / baronbot.stakedAmount
4. apy             = min(((1 + min(monthly_rate, 0.50))^12 − 1) * 100, 1000)
```

**Live at time of writing: ~30% APY** — not a fixed rate; drifts with weekly fishing + gacha revenue.

### Example reply

> **KIBBLE tokenomics (live):** ~66% of supply has been burned, ~24% of circulating is staked in Wealth & Whiskers, and staking currently pays ~30% APY. Want me to walk you through staking? The lock period is 14 days.

Full formulas, APY caps, and the live worked example: [references/kibble/tokenomics.md](references/kibble/tokenomics.md).

---

## Executing transactions via Bankr

For any write call (`approve`, `stake`, `claim`, `claimAndRestake`, `unlock`, `relock`, `unstake`):

Natural-language Bankr agent prompt:

```bash
bankr agent prompt "Stake 1000 KIBBLE in Cat Town"
```

Or encode calldata and submit directly:

```bash
bankr wallet submit --to 0x9e1Ced3b5130EBfff428eE0Ff471e4Df5383C0a1 --data <encoded-calldata> --chain base
```

Remember: submit the ERC-20 `approve` on the KIBBLE token (`0x64cc19A52f4D631eF5BE07947CABA14aE00c52Eb`, target = RevenueShare) before `stake` if the current allowance is insufficient.

---

## Pitfalls

- **Forgetting the approval.** `stake` reverts cleanly but wastes a user's tx. Read `allowance(user, revenueShare)` first; only approve if low.
- **Unstaking while unlocking.** Reverts. Check `isUnlocking(user)` and `unlockEndTime(user)` before constructing an `unstake` tx.
- **Assuming continuous rewards.** `pendingRewards` is a step function — it only goes up when the backend calls `depositRevenue`. Between deposits, polling will show no change, and that is correct. Use the calendar above to set expectations.
- **Stale `LOCK_PERIOD` assumptions.** Currently **14 days** (1,209,600 seconds); safe to quote at the point of unlock because `unlockEndTime` is snapshotted per-user. Read `LOCK_PERIOD()` live only if you want defensive protection against UUPS upgrades.
- **Using the legacy contract.** An older staking contract (`0xc3398Ae89bAE27620Ad4A9216165c80EE654eE96`) exists but is deprecated. Do not send new stakes there.

---

## Troubleshooting

### `ERC20: transfer amount exceeds balance` on `stake`

**99% certainty: you wei-encoded the `stake` argument.** RevenueShare takes `amount` in whole KIBBLE and multiplies by `10^18` internally. If you pass `N × 10^18` thinking it's wei, the contract attempts to pull `N × 10^36` tokens from your balance, which trivially exceeds any balance.

Fix: pass the whole-KIBBLE integer. To stake 100 KIBBLE, call `stake(100)`, not `stake(100000000000000000000)`.

The KIBBLE `approve()` call is the opposite — it's a standard ERC-20 call and *does* take wei. So the correct 100-KIBBLE flow is:

```
kibble.approve(revenueShare, 100_000000000000000000)   // 100 × 10^18 wei
revenueShare.stake(100)                                // whole KIBBLE
```

Confirmed by onchain simulation against `0x9e1Ced3b5130EBfff428eE0Ff471e4Df5383C0a1`:

| Call | Expected behaviour |
|---|---|
| `stake(1)` with ≥1 KIBBLE allowance | succeeds (stakes 1 KIBBLE) |
| `stake(100)` with =100 KIBBLE allowance | succeeds, hits cap exactly |
| `stake(101)` with 100 KIBBLE allowance | reverts `transfer amount exceeds allowance` |
| `stake(1e18)` with 100 KIBBLE allowance | reverts `transfer amount exceeds balance` ← the mistake |

### `ERC20: transfer amount exceeds allowance` on `stake`

`stake(N)` requires `allowance(signer, revenueShare) ≥ N × 10^18` on the KIBBLE token. Call `approve(revenueShare, N × 10^18)` from the same signer first.

### `unstake` reverts with no obvious reason

Check `isUnlocking(signer)`. If `true`, `unstake` reverts until `block.timestamp >= unlockEndTime(signer)`. Either wait out the window or call `relock()` to cancel the unlock and return to the earning pool.

### Diagnostic no-arg write tests

To verify the signer + contract are wired up without any amount-encoding risk:

- `unlock()` — no args. Succeeds even with 0 staked (sets `isUnlocking = true`). Follow with `relock()` immediately to avoid side effects.
- `claim()` — no args. No-ops cleanly when `pendingRewards(signer) == 0`.
