# RevenueShare Contract Reference

Single-pool, single-reward staking for KIBBLE on Base. Deployed as a UUPS proxy (upgradeable) — always read values like `LOCK_PERIOD()` from chain rather than hardcoding.

## Addresses

| Chain             | Chain ID | RevenueShare                                   | KIBBLE (ERC-20, 18 decimals)                   |
|-------------------|----------|------------------------------------------------|------------------------------------------------|
| Base mainnet      | 8453     | `0x9e1Ced3b5130EBfff428eE0Ff471e4Df5383C0a1`   | `0x64cc19A52f4D631eF5BE07947CABA14aE00c52Eb`   |
| Base Sepolia      | 84532    | `0x04ef20ca98d65d4c659a805daa57e0ff4b44f46f`   | `0x7C1059Bdcf44BC2BC1452c67e6A50cE1AB69C49C`   |

Legacy (deprecated) staking contract on Base: `0xc3398Ae89bAE27620Ad4A9216165c80EE654eE96` — do not route new stakes there.

## Reward accounting model

Masterchef-style single pool:

```
pendingRewards(user) = (userStaked(user) * (accRewardPerShare - rewardDebt(user))) / 1e18
```

- `accRewardPerShare` is updated on each `depositRevenue(amount, source)` call:
  ```
  accRewardPerShare += (amount * 1e18) / totalActiveStaked
  ```
- `rewardDebt(user)` is snapshotted on every user action (`stake`, `claim`, `claimAndRestake`, `unlock`, `relock`, `unstake`).
- Users in an `unlock()` window are subtracted from `totalActiveStaked`, so they neither earn nor dilute active stakers.

## Write functions

All amounts are `uint256` wei (18 decimals).

### `stake(uint256 amount)`

Pulls `amount` KIBBLE from `msg.sender` (requires prior ERC-20 approval) and credits it to the user's position. Emits `Staked(indexed address user, uint256 amount)`.

Reverts if:
- Allowance too low (standard ERC-20 revert)
- `amount == 0` (check if ambiguous; safer for agents to always pass > 0)

### `unstake(uint256 amount)`

Returns `amount` KIBBLE to `msg.sender`. Emits `Unstaked(indexed address user, uint256 amount)`.

Reverts if:
- `isUnlocking[user] == true` and `block.timestamp < unlockEndTime[user]`
- `amount > getUserStaked(user)`

### `unlock()`

Starts the exit wait. Sets `isUnlocking[user] = true`, `unlockStartTime[user] = block.timestamp`, `unlockEndTime[user] = block.timestamp + LOCK_PERIOD()`. Removes the user's stake from `totalActiveStaked`. Emits `UnlockInitiated(indexed address user, uint256 unlockEndTime)`.

### `relock()`

Cancels an in-progress unlock. Sets `isUnlocking[user] = false` and returns the user to `totalActiveStaked`. Emits `Relocked(indexed address user, uint256 amount)`.

### `claim()`

Transfers `pendingRewards(user)` KIBBLE to `msg.sender` and updates `rewardDebt`. Emits `Claimed(indexed address user, uint256 amount)`.

### `claimAndRestake()`

Computes `pendingRewards(user)` and adds it directly to the user's stake (no token transfer out, no ERC-20 approval needed). Emits `ClaimedAndRestaked(indexed address user, uint256 restakedAmount, uint256 totalStakedNow)`.

### Admin / owner-only

| Function                                                           | Notes                                  |
|--------------------------------------------------------------------|----------------------------------------|
| `depositRevenue(uint256 amount, string source)`                    | Cat Town backend only; updates `accRewardPerShare`. Emits `RevenueDeposited(string source, uint256 depositTimestamp, uint256 depositAmount, uint256 newAccRewardPerShare)`. `source` ∈ `"fishing"`, `"gacha"`, `"daycare"` (daycare not yet active). |
| `setKibbleToken(address)`                                          | Owner only.                            |
| `recoverERC20(address tokenAddress, uint256 tokenAmount)`          | Owner only; for stuck non-KIBBLE tokens. |
| `initialize(address _owner, address _kibbleToken)`                 | Proxy init; not callable post-deploy.  |
| `upgradeToAndCall(address newImplementation, bytes data)`          | UUPS upgrade; owner only.              |
| `transferOwnership(address newOwner)` / `renounceOwnership()`      | Standard OZ Ownable.                   |

## Read functions

All return `uint256` in wei unless noted.

| Call                                | Returns      | Meaning                                                        |
|-------------------------------------|--------------|----------------------------------------------------------------|
| `getUserStaked(address user)`       | `uint256`    | Currently staked KIBBLE (same as `userStaked(user)`).          |
| `userStaked(address)`               | `uint256`    | Raw mapping read; equivalent to `getUserStaked`.               |
| `pendingRewards(address user)`      | `uint256`    | Claimable KIBBLE right now.                                    |
| `getPoolShareFraction(address user)`| `uint256`    | User's share of the active pool, scaled by 1e18.               |
| `isUnlocking(address)`              | `bool`       | True iff user has an open `unlock()` they haven't closed.      |
| `unlockStartTime(address)`          | `uint256`    | Unix seconds when `unlock()` was called.                       |
| `unlockEndTime(address)`            | `uint256`    | Unix seconds when `unstake()` becomes callable.                |
| `getTotalStaked()` / `totalStaked`  | `uint256`    | All KIBBLE held by the contract (includes unlocking users).    |
| `getTotalActiveStaked()` / `totalActiveStaked` | `uint256` | KIBBLE earning rewards right now.                          |
| `accRewardPerShare()`               | `uint256`    | Global reward accumulator, scaled by 1e18.                     |
| `rewardDebt(address)`               | `uint256`    | Per-user snapshot used in the `pendingRewards` formula.        |
| `LOCK_PERIOD()`                     | `uint256`    | Unlock wait duration in seconds. Read live — contract is upgradeable. |
| `kibbleToken()`                     | `address`    | KIBBLE ERC-20 address.                                         |
| `owner()`                           | `address`    | Current owner (Cat Town deployer).                             |

## Events

| Event                                                                                        | When                               |
|----------------------------------------------------------------------------------------------|------------------------------------|
| `Staked(indexed address user, uint256 amount)`                                               | On `stake`.                        |
| `Unstaked(indexed address user, uint256 amount)`                                             | On `unstake`.                      |
| `UnlockInitiated(indexed address user, uint256 unlockEndTime)`                               | On `unlock`.                       |
| `Relocked(indexed address user, uint256 amount)`                                             | On `relock`.                       |
| `Claimed(indexed address user, uint256 amount)`                                              | On `claim`.                        |
| `ClaimedAndRestaked(indexed address user, uint256 restakedAmount, uint256 totalStakedNow)`   | On `claimAndRestake`.              |
| `RevenueDeposited(string source, uint256 depositTimestamp, uint256 depositAmount, uint256 newAccRewardPerShare)` | On `depositRevenue` (backend only). Watch this to detect the weekly drops. |
| `OwnershipTransferred(indexed address previousOwner, indexed address newOwner)`              | Standard OZ Ownable.               |
| `Initialized(uint64 version)` / `Upgraded(indexed address implementation)`                   | Proxy lifecycle.                   |

## Transaction-building checklist

For any stake flow, before constructing calldata:

1. Read `allowance(user, revenueShare)` on the KIBBLE token. If `< amount`, include an `approve(revenueShare, amount)` tx first.
2. For `unstake`: read `isUnlocking(user)` and `unlockEndTime(user)`. Abort with a clear error if the wait isn't over.
3. For any write: `getUserStaked(user)` and `pendingRewards(user)` are cheap reads that help you give the user an accurate pre-tx preview.
