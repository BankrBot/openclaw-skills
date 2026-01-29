# Time-Locked Fee Wrappers

## Overview

Create tradeable tokens representing temporary fee claiming rights. Holders can claim proportional fees during the lock period.

## Lock Tiers

| Tier | Duration | Use Case |
|------|----------|----------|
| `ONE_DAY` (5) | 24 hours | Daily fee auctions, short-term access |
| `ONE_WEEK` (6) | 7 days | Weekly fee packages |
| `ONE_MONTH` (0) | 30 days | Monthly subscriptions |

## Contract

**TimeWrapper Factory**: `0x083EDF9b6C894561Ce8a237e2fd570bECB920DfF`

## Multiplier

**1M:1** — Deposit 80 fee tokens → Receive 80,000,000 wrapper tokens

This high multiplier enables granular trading of fee rights.

## Flow

```
1. Deploy wrapper contract
2. Approve fee tokens
3. Deposit fee tokens (locked for duration)
4. Receive wrapper tokens (tradeable)
5. Wrapper holders claim fees proportionally
6. After expiry: withdraw original fee tokens
```

## Functions

```solidity
// Create wrapper for a fee vault
function createWrapper(
    address vault,
    address[] tokens,
    string name,
    string symbol
) external returns (address wrapper)

// Deposit and lock
function deposit(
    uint256 amount,
    uint8 lockTier
) external

// Claim accumulated fees
function claimRewards(address holder) external returns (uint256[] amounts)

// Withdraw after lock expires
function withdraw(uint256 amount) external
```

## Example

```typescript
// Create wrapper
const wrapper = await wrapperFactory.createWrapper(
  vaultAddress,
  [WETH, tokenAddress],
  "ClawdFans 1D",
  "CLAWDFANS-1D"
);

// Approve and deposit
await feeToken.approve(wrapper.address, amount);
await wrapper.deposit(amount, 5); // LockTier.ONE_DAY

// Now you have wrapper tokens
const wrapperBalance = await wrapper.balanceOf(user);
// = amount * 1,000,000
```

## Claiming Fees

Wrapper holders claim fees proportionally:

```typescript
// Anyone holding wrapper tokens can claim
const [wethReward, tokenReward] = await wrapper.claimRewards(holder);
```

## Trading Wrappers

Wrapper tokens are standard ERC20s. You can:
- Sell on Uniswap
- Airdrop to community
- Use as rewards
- Create wrapper/ETH liquidity pool

## Rotation

After lock expires:
1. Withdraw original fee tokens
2. Create new wrapper with same or different duration
3. Repeat

This enables perpetual fee auction cycles.

## Use Cases

1. **Daily Fee Auctions**: Sell 1D wrappers to highest bidder
2. **Community Rewards**: Airdrop wrappers to active members
3. **Subscription Model**: Sell weekly/monthly fee access
4. **Speculation**: Let market price fee rights
