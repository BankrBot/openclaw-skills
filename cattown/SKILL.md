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

*During the weekend fishing competition (Sat–Sun), 10% of every fish identification feeds the KIBBLE stakers pool. Weekday fishing (Skipper) does **not** feed stakers. This is why weekend activity sizes the following Monday's fishing-revenue deposit. See [references/cattown-calendar.md](references/cattown-calendar.md) for the full revenue split.

Deposits are triggered by the Cat Town backend calling `depositRevenue(amount, source)` on RevenueShare, with `source` in `"fishing"` or `"gacha"`. Watch the `RevenueDeposited(string source, uint256 depositTimestamp, uint256 depositAmount, uint256 newAccRewardPerShare)` event to know the exact moment a drop lands.

---

## KIBBLE Staking

### Addresses (Base, chain id 8453)

- **RevenueShare**: `0x9e1Ced3b5130EBfff428eE0Ff471e4Df5383C0a1`
- **KIBBLE token (ERC-20, 18 decimals)**: `0x64cc19A52f4D631eF5BE07947CABA14aE00c52Eb`

Base Sepolia addresses and the full ABI surface are in [references/staking-contract.md](references/staking-contract.md).

### Core flows

Single pool, single reward token — KIBBLE in, KIBBLE out. No reward-token selection, no per-user lock duration, no multipliers. One global `accRewardPerShare` accumulator updated on each `depositRevenue`.

**1. Stake**
1. `kibble.approve(revenueShare, amount)` — required once if `allowance(user, revenueShare) < amount`.
2. `revenueShare.stake(uint256 amount)` — emits `Staked(user, amount)`.

**2. Claim** (after each fishing/gacha deposit)
- `revenueShare.claim()` — transfers `pendingRewards(user)` to the user. Emits `Claimed(user, amount)`.
- `revenueShare.claimAndRestake()` — claims and auto-adds to the user's stake in one tx. Emits `ClaimedAndRestaked(user, restakedAmount, totalStakedNow)`.

**3. Exit (unlock → wait → unstake)**
1. `revenueShare.unlock()` — emits `UnlockInitiated(user, unlockEndTime)`. Sets `isUnlocking[user] = true`.
2. Wait until `block.timestamp >= unlockEndTime(user)`. The wait length is `LOCK_PERIOD()` — **always read this from chain; do not hardcode** (the contract is UUPS-upgradeable).
3. `revenueShare.unstake(uint256 amount)` — reverts before the wait ends. Emits `Unstaked(user, amount)`.
- `revenueShare.relock()` — at any time during the wait, cancels the unlock and puts the user back into the earning pool. Emits `Relocked(user, amount)`.

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

All return `uint256` in wei (18 decimals) unless noted.

| Call                               | Meaning                                                            |
|------------------------------------|--------------------------------------------------------------------|
| `getUserStaked(address)`           | Currently staked KIBBLE                                            |
| `pendingRewards(address)`          | Claimable KIBBLE right now                                         |
| `isUnlocking(address)` → `bool`    | True if user has called `unlock()` and not yet unstaked/relocked   |
| `unlockStartTime(address)`         | Unix seconds when `unlock()` was called                            |
| `unlockEndTime(address)`           | Unix seconds when `unstake()` becomes callable                     |
| `getPoolShareFraction(address)`    | User's share of the active pool (scaled by 1e18)                   |
| `getTotalActiveStaked()`           | Total KIBBLE earning rewards right now                             |
| `getTotalStaked()`                 | Total KIBBLE held by the contract (includes unlocking users)       |
| `LOCK_PERIOD()`                    | Unlock wait duration in seconds                                    |
| `accRewardPerShare()`              | Global reward accumulator (scaled by 1e18)                         |

Full function-by-function reference: [references/staking-contract.md](references/staking-contract.md).

### Staking leaderboard & user deposit history

Two public JSON endpoints on `https://api.cat.town`, **no auth required**. Use these whenever the user wants their rank, their share of the pool, or their weekly earnings history without paying RPC costs.

- `GET /v2/revenue/staking/leaderboard` — ranked stakers with stake amount and pool-share %.
- `GET /v2/revenue/deposits/{address}` — one user's historical `fishing` / `gacha` deposits, per-tx amounts, and the share that landed for that user.

Full shapes, field meanings, and example responses: [references/staking-api.md](references/staking-api.md).

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
- **Hardcoding `LOCK_PERIOD`.** Read it from chain every time — the contract is UUPS-upgradeable.
- **Using the legacy contract.** An older staking contract (`0xc3398Ae89bAE27620Ad4A9216165c80EE654eE96`) exists but is deprecated. Do not send new stakes there.
