# GTM Contract ABI Reference

## Contract Address
`TBD` on Base (chainId 8453) — v2 pending redeployment

## Betting Functions

### betHigher()
Bet that today's temp will be HIGHER than yesterday's. Multiple bets allowed per round.

```solidity
function betHigher() external payable
```
- **Selector**: `0xb3dd0f5a`
- **Value**: Amount to bet (min 0.001 ETH, max 0.002 ETH in safe mode)

### betLower()
Bet that today's temp will be LOWER or equal to yesterday's. Multiple bets allowed per round.

```solidity
function betLower() external payable
```
- **Selector**: `0x771a2ab3`
- **Value**: Amount to bet (min 0.001 ETH, max 0.002 ETH in safe mode)

## Claim Functions

### claim(uint256)
Claim winnings (or refund) for a settled round. Winners pay their own gas.

```solidity
function claim(uint256 round) external
```
- **Selector**: `0x379607f5`
- **Reverts**: "Round not settled", "Already claimed", "Nothing to claim"

### claimable(uint256,address)
Check how much a user can claim for a given round.

```solidity
function claimable(uint256 round, address user) external view returns (uint256)
```
- **Selector**: `0xa0c7f71c`
- Returns 0 if not settled, already claimed, or no winnings

## Read Functions

### getMarketState()
Get full market state.

```solidity
function getMarketState() external view returns (
    uint256 round,
    int256 baseline,      // divide by 100 for °C
    uint256 higherTotal,  // wei
    uint256 lowerTotal,   // wei
    uint256 rollover,     // wei
    bool isBettingOpen,
    uint256 secondsUntilClose,
    uint256 secondsUntilSettle
)
```

### bettingOpen()
Check if betting is currently open.

```solidity
function bettingOpen() external view returns (bool)
```

### yesterdayTemp()
Get yesterday's baseline temperature.

```solidity
function yesterdayTemp() external view returns (int256)
```
Returns temperature with 2 decimal places (e.g., 1210 = 12.10°C)

### getMyBet(address)
Get a user's bet for current round.

```solidity
function getMyBet(address user) external view returns (uint256 higherAmt, uint256 lowerAmt)
```

### safeMode()
Check if safe mode is active (bet cap enforced).

```solidity
function safeMode() external view returns (bool)
```

### maxBet()
Get the maximum bet amount (0 = no limit).

```solidity
function maxBet() external view returns (uint256)
```

## Events

```solidity
event BetPlaced(uint256 indexed round, address indexed bettor, bool isHigher, uint256 amount, int256 baseline);
event RoundSettled(uint256 indexed round, int256 todayTemp, int256 yesterdayTemp, bool higherWon, bool wasTie, uint256 totalPot, uint256 houseFee);
event WinningsClaimed(uint256 indexed round, address indexed bettor, uint256 amount);
```
