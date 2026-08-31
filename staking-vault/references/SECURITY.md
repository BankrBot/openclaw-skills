# StakingVault — Security Audit

**Auditor:** Axiom (self-audit, pre-deployment)
**Date:** 2026-05-13
**Scope:** `src/StakingVault.sol` only. ERC-4626 + cooldown logic. No external integrations, no off-chain components.

This file documents the audit findings against the contract originally deployed as `StakedAxiom` (xAXIOM). The generic `StakingVault` contract is the same code with `name_` / `symbol_` lifted to constructor arguments — the security properties carry over identically.

## Findings

| # | Severity | Title | Status |
|---|---|---|---|
| 1 | **Critical** | Mid-cooldown deposit bypasses the JIT defense | Fixed |
| 2 | **Medium** | Inflation attack possible with default `_decimalsOffset() = 0` | Fixed |
| 3 | Low | Owner can extend `cooldownPeriod` mid-flight | Accepted risk |
| 4 | Informational | `maxRedeem` / `maxWithdraw` not ERC-4626-spec-compliant | Fixed |
| 5 | Style | `cooldown()` used a string `require`; mixed with custom errors elsewhere | Fixed |

---

## #1 — Critical: mid-cooldown deposit bypasses the JIT defense

### Attack

1. Attacker stakes 1 wei and calls `cooldown()`.
2. Waits the full cooldown period.
3. Right before a reward arrives, deposits a huge amount.
4. Reward lands → share price spikes.
5. Attacker calls `redeem(all_shares)`. Cooldown timestamp is still old, so the elapsed check passes. Attacker captures the reward on a position they only just opened.

The original cooldown gated **the user**, not **the size of their staked balance**.

### Fix

In `_update`, every share inflow (mint or inbound transfer) to a user with an active cooldown weighted-averages the cooldown timestamp toward `now`:

```
new_cooldown = (incoming * now + currentBalance * old_cooldown) / (incoming + currentBalance)
```

This is the Aave `stkAAVE` pattern. A large top-up pulls the timestamp nearly to `now` (forcing a full new wait), while a small top-up barely moves it.

### Regression tests

- `test_jitDepositAttack_midCooldownRebases`
- `test_smallTopUp_barelyShiftsCooldown`
- `test_inboundTransferRebasesCooldown`

---

## #2 — Medium: inflation attack with default `_decimalsOffset()`

### Attack

OpenZeppelin ERC4626's default `_decimalsOffset()` is 0. The recommended production value is 6+ (Morpho uses 12, Maple uses 6). With offset = 0, the first depositor can:

1. Deposit 1 wei → mints 1 share.
2. Donate `D` of the stake token directly to the vault (via plain `transfer`).
3. Next depositor's shares are `assets × (totalSupply + 1) / (totalAssets + 1) ≈ assets / D` — when `D ≫ assets`, this rounds to 0 and the victim's deposit is captured by the attacker's 1 share.

### Fix

Override `_decimalsOffset()` to return 6. Attacker now needs to donate `~10^6 ×` the smallest deposit they want to grief — cost-prohibitive for any realistically priced stake token.

**Side effect:** the share token has nominal 24 decimals (18 + 6) when the stake token is 18-decimal. Frontends should display `convertToAssets(shares)` for stake-token-denominated user balances. Raw share counts are not user-facing.

### Regression tests

- `test_inflationAttack_mitigated_largeDonation`

---

## #3 — Low (accepted): owner can extend `cooldownPeriod` mid-flight

### Issue

If the owner calls `setCooldownParams` to increase `cooldownPeriod` while users have active cooldowns, their effective unlock time is pushed out. The new value applies retroactively to existing cooldown timestamps.

### Why accepted

- `MAX_COOLDOWN = 30 days` is a hard ceiling. Owner cannot freeze funds indefinitely.
- The owner cannot rescue the stake token, cannot mint, cannot burn, cannot pause, and cannot upgrade.
- A timelock can be added in a follow-up if the role is transferred to a multisig that you don't fully trust.

### Mitigation in production

Document the trust model: by staking, users accept that the owner can extend their cooldown up to 30 days while they're locked. This is consistent with Aave stkAAVE.

---

## #4 — Informational: `maxRedeem` / `maxWithdraw` not spec-compliant

### Issue

ERC-4626 requires `maxRedeem(owner)` to return the amount the owner can redeem *right now*. Without the override, it would return `balanceOf(owner)` even when the cooldown is not in its withdrawal window — causing aggregator UIs (Morpho, Yearn, Beefy) to attempt redemptions that always revert.

### Fix

Override `maxRedeem` and `maxWithdraw` to return 0 unless `cooldownStartedAt[owner] != 0 && block.timestamp ∈ [readyAt, readyAt + withdrawWindow]`.

**Downstream effect:** when a user calls `redeem` or `withdraw` outside the window, they hit OZ's `ERC4626ExceededMaxRedeem(owner, shares, 0)` — not the custom `CooldownNotElapsed` / `WithdrawWindowExpired` errors. Frontends should read `cooldownStatus(owner)` to render the user-facing reason.

The custom errors in `_withdraw` remain as defense in depth — they fire only if a future inheritor calls `_withdraw` directly, bypassing `redeem`/`withdraw`.

### Regression tests

- `test_maxRedeem_zeroWithoutCooldown`
- `test_maxRedeem_zeroBeforeCooldownElapsed`
- `test_maxRedeem_matchesBalanceInWindow`
- `test_maxRedeem_zeroAfterWindowExpired`

---

## Things checked and cleared

- **Reentrancy** — `_withdraw` is `nonReentrant`. OZ's underlying `_withdraw` follows CEI (burn-then-transfer). Standard ERC-20s have no callbacks.
- **Transfer-during-cooldown bypass** — blocked in `_update`, covered by `test_transferBlockedDuringCooldown`.
- **Approval / allowance path** — `redeem(shares, receiver, owner)` checks the *owner*'s cooldown, not the caller's. Correct.
- **Fee-on-transfer assets** — ERC4626's `totalAssets() == stakeToken.balanceOf(vault)` is fee-on-transfer-robust. ⚠ But: if your stake token is FoT, deposits credit fewer shares than naive arithmetic would suggest. Run additional integration tests if you plan to use a non-standard ERC-20.
- **Empty-vault donations** — donating to an empty vault gifts the first staker; donating after a 1-wei seed is mitigated by the offset (see #2).
- **Owner attacks** — owner cannot rescue stake token (`rescueToken` blocks `address(token) == asset()`), cannot mint, cannot burn, cannot pause, cannot upgrade. Only knob is `cooldownPeriod` / `withdrawWindow`, both bounded.
- **Reward delivery flow** — rewards = plain `transfer(vault, amount)`. No callback, no allowance, no privileged sender. Vault has no `notifyReward()` because share-price-based accounting doesn't need one.
- **Integer overflow** — Solidity 0.8.28 has checked arithmetic. The weighted-average expression uses uint256 multiplication; for an 18-decimal token with a 21B supply, `value * block.timestamp` is well under 2^256.
- **First-deposit donation attack** — see #2.

## Out of scope

- **Off-chain pipeline** — your reward distributor, snapshot scripts, frontend, and operational tooling are not covered here.
- **Owner key custody** — the treasury wallet's hot-wallet hygiene is a separate operational concern.
- **Stake token's own security** — the upstream ERC-20's contract, pricing manipulation, and DEX risk are out of scope.

## Recommended pre-deployment steps for your fork

1. Run `forge test -vv` — should be 24/24 passing.
2. Decide on cooldown params. Defaults (3-day cooldown / 2-day window) are sensible for daily reward cadence. Faster reward cadence (hourly) suggests shorter cooldowns; less frequent (weekly) can support longer.
3. Deploy `OWNER` to a multisig if you have one. EOA owner is acceptable while the protocol is small.
4. Make `OWNER` distinct from the deployer key — the deployer key is hot, the owner key should be cold.
5. Verify on the relevant block explorer (the deploy script does this with `--verify`).
6. Test on a testnet first if you're modifying the contract at all.

## Test coverage

`forge test` — 24/24 passing on `solc 0.8.28`, OZ 5.6.1.
