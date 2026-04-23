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

Base Sepolia addresses and the full ABI surface are in [references/staking-contract.md](references/staking-contract.md).

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

Users say "unstake" colloquially to mean the whole exit, not literally the on-chain `unstake()` function. Before acting, read three values: `isUnlocking(user)`, `unlockEndTime(user)`, and the user's current pool share (`getPoolShareFraction(user) / 1e18 * 100` as a percentage). Then route:

| State                                                    | What to call | What to tell the user                                                                 |
|----------------------------------------------------------|--------------|---------------------------------------------------------------------------------------|
| `isUnlocking(user) == false`                             | `unlock()`   | "Started your unlock. Wait is **14 days** — ready at `<unlockEndTime>`. Your pool share just dropped from **Y%** to **0%**; you won't earn revenue deposits during the wait. Call `relock()` any time to cancel and restore your share." |
| `isUnlocking == true` **and** `now < unlockEndTime`      | *(no tx)*    | "Already unlocking. ~X days Y hours left until you can withdraw. Your pool share is **0%** until you either `unstake()` after the wait or `relock()` now."                                                  |
| `isUnlocking == true` **and** `now >= unlockEndTime`     | `unstake(N)` | "Withdrew N KIBBLE." (Or remaining balance if partial.)                                |

Same routing for "withdraw," "exit," "pull my KIBBLE out," "get my stake back." **Never call the on-chain `unstake()` as the first step** — it reverts unless the user has already completed an unlock wait.

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

Full function-by-function reference: [references/staking-contract.md](references/staking-contract.md).

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

Confirmed by on-chain simulation against `0x9e1Ced3b5130EBfff428eE0Ff471e4Df5383C0a1`:

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
