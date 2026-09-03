# Pantheon StakingVault — contract reference (Base)

Vault (V4 proxy): `0xBf52Aaf8b6C82FaD0220B5378022eA4fC0a98fDb` — Base mainnet, chain id 8453.
Live implementation behind the proxy: **`0x1a614b8fa3971be5bd96d31c1b42a1d0040f1974`** (24,103
bytes, solc 0.8.28). `VERSION()` returns **8**.

> **Errata, 2026-08-25.** This file previously named `0xe0c448b467db7c65ed8a0827e057d81d526919b2`
> as the live implementation and predated `VERSION` 8. That address was the **V7** build; the proxy
> was upgraded on 2026-08-24 and the EIP-1967 implementation slot now reads `0x1a614b8f…`. The V7
> build is still live — on Robinhood Chain, byte-for-byte ex-metadata; see
> `staking-contract-rh.md`.
>
> **The v1 verb signatures are unchanged, verified rather than assumed.** All five selectors used by
> this skill were recomputed from their signatures and confirmed present in the new V8 runtime, and
> `stakes()` still returns the same 9-field tuple:
> `stake` `0x946debd5` · `accruedReward` `0x814b57b3` · `claimReward` `0x4953c782` ·
> `pools` `0xa4063dbc` · `stakes` `0xa4e47b66`.
> V8 adds delegated-staking verbs this skill does not call (`stakeOnBehalf` `0x45f54bfd`,
> `addToStakeOnBehalf` `0x9b316ed6`, `initializeV5` `0x16e1f015`, `STAKER_FOR_ROLE` `0x0660bbee`) —
> present on Base, absent on RH.

All signatures below were checked against the deployed ABI on 2026-08-07 and re-confirmed against
the V8 runtime on 2026-08-25 at block 50,420,044.

## ABI fragments (call these exactly)

```
function stake(address stakingToken, uint16 lockMonths, uint256 amount, bool autoRestakeOptIn)
function accruedReward(address user, address stakingToken, address rewardToken) view returns (uint256)
function claimReward(address stakingToken, address rewardToken)
function pools(address stakingToken) view returns (bool active, uint32 cliffMonths, uint256 totalStaked)
function stakes(address user, address stakingToken) view returns (
    uint256 amount,
    bool    autoRestake,
    uint16  lockMonths,
    uint32  lockDuration,
    uint32  stakeTime,
    uint32  unstakeRequestTime,
    uint32  unstakeTime,
    uint32  stakeMonthIndex,
    bool    compounderEnabled
)
```

Selectors, if you need to match them: `stake` `0x946debd5` · `accruedReward` `0x814b57b3` · `claimReward` `0x4953c782` · `pools` `0xa4063dbc` · `stakes` `0xa4e47b66`.

ERC-20 approve first: `approve(0xBf52Aaf8b6C82FaD0220B5378022eA4fC0a98fDb, exactAmount)` on the token contract.

Rules:
- `lockMonths` is always `6` — the contract rejects every other value. `autoRestakeOptIn` is always `false` (skill policy).
- In `stake`, the **amount is the third argument**, after `lockMonths`. Getting this order wrong is the easiest way to send a wrong-sized transaction.
- Amounts are raw units (`human * 10^decimals`, decimals from the registry).
- Before staking, check `pools(token).active == true`; if false, refuse — the vault is not live.

## Reading a position

- `stakes(user, stakingToken)` returns the tuple above. Field `0` is the staked amount; field `7` (`stakeMonthIndex`) is the calendar-month anchor for every date the user cares about. Field `4` (`stakeTime`) is the raw stake timestamp — do **not** compute the lock end from it by adding six months; see `timing-and-fees.md`.
- A position is empty when `amount == 0`.

## Reward tokens — a pool can have several

`accruedReward` and `claimReward` are **per reward token**. There is no "claim everything" call.

**The only valid source is the registry's `reward_tokens` field.** Use it.

### Do NOT use `poolRewardTokens` as the reward-token list

The contract exposes `poolRewardTokens(stakingToken, i)`, and it looks like the natural on-chain enumeration. **It is incomplete by construction and will silently hide live rewards from users.**

That array is only written by the V3-era `fundRewardPool`. Pools funded before V3 have reward tokens that are still accruing and still claimable but were never added, and the V3 migration deliberately did not backfill them. Accrual is read from a different mapping (`rewardPoolBalances`), so a token can pay out forever while being absent from the array.

Measured on Base mainnet, 2026-08-07:

| Pool | `poolRewardTokens` says | Actually also paying |
|---|---|---|
| FADED `0x21F9…3fEB` | 1 token (USDC) | **FADED itself — 19,791,666/mo, 475,000,000 total**, `isRewardTokenForPool` returns `false` |
| BWIL `0xd830…f289` | 5 tokens | **BWIL itself — 11,875,000/mo, 285,000,000 total**, `isRewardTokenForPool` returns `false` |

An agent that enumerated the array on the FADED pool would report USDC only and miss the single largest reward stream in that pool.

`isRewardTokenForPool(pool, token)` has the same defect — a `false` return is **not** evidence the pool doesn't pay that token.

**If the registry is unreachable:** tell the user you cannot confirm their full reward list right now and send them to https://pantheonvaults.com. A partial list presented as complete is worse than no list. You may still claim a specific reward token if the user names one — `accruedReward` and `claimReward` work correctly for any token, listed or not.

## Revert codes — translate honestly, never guess

| Selector | Error | Tell the user |
|---|---|---|
| `0x2083cd40` | InvalidPool() | This vault isn't active on-chain. Don't retry; check pantheonvaults.com. |
| `0xea2d0505` | NotYetEarning() | Rewards aren't claimable yet — claiming opens at 00:00 UTC on the 1st of the second calendar month after you staked. Give the date. |
| `0x5aa9184d` | NoRewardToClaim() | Nothing to claim for that reward token right now (already claimed, or nothing accrued yet). |
| `0xfb348942` | NoActiveStake() | This wallet has no active stake in that vault. |
| `0xfa499066` | InvalidLockMonths(uint16) | The term must be exactly 6 months. This is a bug in the request — do not retry with a different number. |
| `0x1f2a2005` | ZeroAmount() | The stake amount was zero. |
| `0x7cac15fa` | StakeAlreadyActive() | This wallet already has an active stake in that vault. Pantheon allows one position per wallet per vault; add to it on pantheonvaults.com. |
| `0x3498ce58` | RestakeCooldownNotFinished() | This wallet unstaked from that vault recently and must wait 7 days before staking again. |
| `0xb509bbcf` | CliffNotPassed() | The 6-month lock hasn't ended, so a normal unstake can't be requested yet. Give the lock-end date. Do not offer emergency exit as a workaround unless the user asks. |
| `0x08c379a0` | Error(string) | **Not a vault error.** Decode the string and relay it. In practice this is the *token* contract, e.g. `"Insufficient allowance"` — the approve step was missed or was too small. Re-approve the exact amount. |

**Which error you get on a pool that doesn't exist depends on the call.** `stake` checks the pool first and reverts `InvalidPool` (`0x2083cd40`). `claimReward` checks the *position* first, so an unknown pool reverts `NoActiveStake` (`0xfb348942`), not `InvalidPool`. Don't read `NoActiveStake` from a claim as proof the vault is fine.

The last two rows were added 2026-08-25 from the Robinhood Chain pack, where both were observed
live via `eth_call`. They are carried to Base on the strength of the shared contract lineage (byte-identical ex-metadata
across chains, proven in `staking-contract-rh.md`) and the
recomputed selectors above — `CliffNotPassed` is declared in the deployed Base ABI, and
`Error(string)` `0x08c379a0` is the ERC-20 standard string revert, not a vault error at all. Flagged
as carried-over rather than presented as separately measured on Base.

Any other revert: report the raw selector and link the user to pantheonvaults.com support. Do not improvise an explanation.
