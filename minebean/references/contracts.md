# MineBean Contract Reference

Function signatures and revert reasons for calldata construction. The Bankr agent consults this when building transactions.

## Network

- **Chain:** Base mainnet
- **Chain ID:** 8453
- **RPC:** Any Base RPC (e.g. `https://mainnet.base.org`)

## Addresses

| Contract   | Address                                       |
|------------|-----------------------------------------------|
| GridMining | `0x9632495bDb93FD6B0740Ab69cc6c71C9c01da4f0`  |
| Bean       | `0x5c72992b83E74c4D5200A8E8920fB946214a5A5D`  |
| AutoMiner  | `0x31358496900D600B2f523d6EdC4933E78F72De89`  |
| Staking    | `0xfe177128Df8d336cAf99F787b72183D1E68Ff9c2`  |
| Treasury   | `0x38F6E74148D6904286131e190d879A699fE3Aeb3`  |
| BEAN/ETH LP (Uniswap V3) | Pool id `0xd7e5522c9cc3682c960afada6adde0f8116580f2ad2cef08c197faf625e53842` |

## GridMining

### Functions

```solidity
function deploy(uint8[] calldata blockIds) external payable
// Deploy ETH equally across blocks. msg.value / blockIds.length per block.
// Reverts: AlreadyDeployedThisRound, RoundNotActive, BelowMinimumDeploy, InvalidBlockId

function claimETH() external
// Claim accumulated ETH rewards across all rounds.

function claimBEAN() external
// Claim accumulated BEAN. 10% roasting fee on mined portion. Roasted bonus untaxed.

function getCurrentRoundInfo() external view returns (
    uint64 roundId,
    uint256 startTime,
    uint256 endTime,
    uint256 totalDeployed,
    uint256 timeRemaining,
    bool isActive
)

function getTotalPendingRewards(address user) external view returns (
    uint256 pendingETH,
    uint256 unroastedBEAN,
    uint256 roastedBEAN,
    uint64 uncheckpointedRound
)

function getPendingBEAN(address user) external view returns (
    uint256 gross,
    uint256 fee,
    uint256 net
)

function getRoundDeployed(uint64 roundId) external view returns (uint256[25] memory)

function getMinerInfo(uint64 roundId, address user) external view returns (
    uint32 deployedMask,
    uint256 amountPerBlock,
    bool checkpointed
)

function beanpotPool() external view returns (uint256)

function currentRoundId() external view returns (uint64)
```

### Custom errors

| Error | When |
|---|---|
| `AlreadyDeployedThisRound()` | User tries to deploy a second time in the same round |
| `RoundNotActive()` | Round is in settlement window |
| `BelowMinimumDeploy()` | `msg.value / blockIds.length < 0.0000025 ETH` |
| `InvalidBlockId()` | A `blockId` outside `[0, 24]` was passed |

## Bean (ERC20)

Standard ERC20. Notable:

```solidity
function approve(address spender, uint256 amount) external returns (bool)
function transfer(address to, uint256 amount) external returns (bool)
function balanceOf(address account) external view returns (uint256)
function allowance(address owner, address spender) external view returns (uint256)
```

Decimals: 18. Total supply cap: 3,000,000 BEAN.

## Staking

```solidity
function deposit(uint256 amount) external
// Stake BEAN. Requires prior Bean.approve(stakingAddr, amount).

function withdraw(uint256 amount) external
// Unstake. Instant, no lock, no penalty.

function claimYield() external
// Claim accumulated yield in BEAN.

function compound() external
// Claim yield and restake atomically. No fee, no cooldown for self-call.

function depositCompoundFee() external payable
// Pre-deposit ETH so executor bots can auto-compound for you.

function getStakeInfo(address user) external view returns (
    uint256 balance,
    uint256 pendingRewards,
    uint256 compoundFeeReserve,
    uint256 lastClaimAt,
    uint256 lastDepositAt,
    uint256 lastWithdrawAt,
    bool canCompound
)

function getPendingRewards(address user) external view returns (uint256)

function getGlobalStats() external view returns (
    uint256 totalStaked,
    uint256 totalYieldDistributed,
    uint256 accYieldPerShare
)
```

### Staking flow

```
1. tx1: Bean.approve(stakingAddr, amount)
2. wait for tx1 confirmation
3. tx2: Staking.deposit(amount)
```

Both transactions are required for a fresh stake. If the user already has sufficient allowance, skip tx1.

## AutoMiner

```solidity
function setConfig(
    uint8 strategyId,    // 0=Random, 1=All, 2=Select
    uint256 numRounds,   // number of rounds to run for
    uint8 numBlocks,     // 1..25 (for Random and Select); 0 for All
    uint32 blockMask     // bits 0..24 for Select strategy; 0 otherwise
) external payable

function stop() external
// Refund remaining rounds.

function configs(address user) external view returns (/* full struct */)

function getUserState(address user) external view returns (/* config + progress */)

function getConfigProgress(address user) external view returns (
    bool active,
    uint256 numRounds,
    uint256 roundsExecuted,
    uint256 roundsRemaining,
    uint256 percentComplete
)
```

### Strategy semantics

| strategyId | Strategy | numBlocks | blockMask |
|---|---|---|---|
| 0 | Random | 1..25 (executor picks N random blocks each round) | 0 |
| 1 | All | 0 (contract sets to 25) | 0 |
| 2 | Select | matches popcount of `blockMask` | bitmask of chosen blocks |

### Deposit math (frontend mirror of contract)

The contract charges `max(percentageFee, flatFee)` per round.

```
EXECUTOR_FEE_BPS = 100         // 1%
EXECUTOR_FLAT_FEE = 0.000006 ETH

pctFeePerRound = perBlockAmount * numBlocks * EXECUTOR_FEE_BPS / 10000

if (pctFeePerRound >= EXECUTOR_FLAT_FEE) {
  deposit = perBlockAmount * totalBlocks * (10000 + EXECUTOR_FEE_BPS) / 10000
} else {
  deposit = perBlockAmount * totalBlocks + EXECUTOR_FLAT_FEE * numRounds
}
```

For `strategy=All`, `totalBlocks = 25 * numRounds`.
For `strategy=Random` with `numBlocks=N`, `totalBlocks = N * numRounds`.
For `strategy=Select` with `blockMask=M`, `totalBlocks = popcount(M) * numRounds`.

### blockMask helpers

```
blockMask = sum over selected_blocks of (1 << blockId)
```

Example: blocks 0, 5, 10 -> `(1<<0) | (1<<5) | (1<<10)` = `1 | 32 | 1024` = `1057` (`0x421`).

To check if block `i` is in the mask: `(blockMask >> i) & 1 == 1`.

## Token swap

Bankr's standard swap routing handles BEAN/ETH directly via the Uniswap V3 LP. No special integration needed. Pair:

- Token in/out: `BEAN` `0x5c72992b83E74c4D5200A8E8920fB946214a5A5D` <-> `WETH` (Base)
- Pool: Uniswap V3, see `BEAN/ETH LP` address above.

For programmatic builds, use 0x Swap API on Base or call the Uniswap V3 router directly.
