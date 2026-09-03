# Pantheon reward timing, fees, and exit rules

## The calendar-month model

Rewards are anchored to real calendar months (UTC boundaries), not day counts. The contract converts a timestamp to a month index — whole calendar months since January 1970, UTC, with real leap-year handling — and every date below is a month boundary at `00:00:00 UTC`.

- Stake in **Month A** → you earn nothing in Month A, no matter which day of the month you staked.
- Earning begins at the **start of Month B** (the next calendar month).
- The first claim opens at the **start of Month C** (the month after B).

**Do not compute any of these dates as an offset from the stake timestamp.** Someone who stakes on 1 August and someone who stakes on 31 August get identical dates.

### The three dates

Let `A` = the calendar month containing the stake (the contract stores this as `stakeMonthIndex`, field 7 of `stakes()`).

| Date | Formula | Example: staked any day of Aug 2026 |
|---|---|---|
| **Rewards start** | 1st of month `A + 1`, 00:00 UTC | 1 Sep 2026 |
| **First claim** | 1st of month `A + 2`, 00:00 UTC | 1 Oct 2026 |
| **Lock ends** | 1st of month `A + 7`, 00:00 UTC | **1 Mar 2027** |

The lock runs to the start of the **7th** month after the stake month because the stake month earns nothing: you earn across months `A+1 … A+6`, and the lock releases once that sixth earning month completes.

> ⚠️ **The lock end is NOT "stake time + 6 months".** For an August 2026 stake, "+6 months" gives 7 Feb 2027 — **22 days early**. Quoting that date would lead a user to request an unstake while still inside the lock and pay the 10% principal penalty. Always use the calendar formula above.

*(All 107 pools created to date have `cliffMonths = 0`, which is what the table assumes. If `pools(token).cliffMonths` is ever non-zero, every date shifts later by that many months: rewards start `A+1+cliff`, first claim `A+2+cliff`, lock ends `A+7+cliff`.)*

## Fees

| Event | Fee |
|---|---|
| Reward claim | 5% (user receives 95%) |
| Reward deposit by projects | 5% at deposit (already reflected in pools) |

The claim fee is read from the contract as `feePercent()` and was `5` on 2026-08-07. It is operator-adjustable, so prefer reading it live over hardcoding.

## Exit rules — why this agent does not unstake

There is no single `unstake()` function. A normal exit is two calls: `requestUnstake(token)`, then `finalizeUnstake(token)` at least 7 days later.

- `requestUnstake` before a position's FIRST reward claim permanently forfeits ALL accrued rewards. The forfeited rewards are **not burned** — they redistribute to the remaining stakers in the pool, who collect them on their next claim. There is no recovery for the exiter.
- A **10% principal penalty** applies if `requestUnstake` is called before the lock end. The penalty is **split 50/50: 5% burned to `0x…dEaD`, 5% to the treasury.** It is fixed at request time, so waiting before finalizing does not reduce it.
- A **7-day cooling-off** separates `requestUnstake` from `finalizeUnstake`; calling early reverts `CoolingOffNotFinished()` (`0xa79d0533`).
- `emergencyExit` bypasses the cliff and cooling-off and costs **20% of principal** (again split 50/50: 10% burned, 10% treasury). Its reward forfeit is **conditional**: it burns the exiter's share only of reward funding that is still within its distribution cliff. Funding that has already started distributing is not burned — it follows the same redistribute-to-remaining-stakers path as above. On a pool whose funding is past cliff, `emergencyExit` burns **zero** rewards and costs only the 20% principal. Do not describe it as an unconditional reward burn.
- After a `requestUnstake`, `emergencyExit` is blocked.
- The safe order is: claim first (from the claim-open date), then unstake. The Pantheon web app enforces this ordering; chat-driven exits are excluded from this skill, on every chain, with no version planned to add them.
- If a user insists: state the rules above, link https://pantheonvaults.com, and do not execute any exit function.
