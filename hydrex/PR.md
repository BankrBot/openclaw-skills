# Hydrex Skill — Pull Request

## Summary

Adds Hydrex governance skill enabling HYDX locking for veHYDX, optimized voting on liquidity pool gauges, single-sided liquidity deposits into auto-managed strategies, and oHYDX rewards claiming and conversion.

## Features

### Locking
- Lock HYDX to receive veHYDX NFTs with voting power
- Type 1 rolling locks (2-year auto-extending) for maximum power
- Earning power = 1.3x voting power for fee distributions
- Check lock details and NFT balances

### Voting
- Vote on liquidity pools by name or address
- Automatic fee optimization via API
- Natural language voting (e.g., "Vote 50/50 on HYDX/USDC and cbBTC/WETH")
- Pool efficiency calculations (projected fees / voting weight)
- Vote proportions in basis points (10000 = 100%)

### Single-Sided Liquidity
- Deposit a single token into auto-managed liquidity strategies
- Earn oHYDX yield without needing to supply both sides of a pair
- Withdraw as a mix of deposit + counter token (up to 70/30 by value)
- Discover available strategies via API with APR, TVL, and deposit token info

### Rewards
- Check unclaimed oHYDX across all incentive campaigns via Merkle proof API
- Claim all eligible rewards in a single `claimMultiple` transaction
- Convert oHYDX into a rolling veHYDX lock via `exerciseVe`

### Integration
- All read and write operations use Bankr natural language execution
- Pool data from `https://api.hydrex.fi/strategies`
- Contract-level technical reference (function selectors, parameter encoding) included for agent implementation

## Structure

```
hydrex/
├── SKILL.md                          # Main skill overview
└── references/
    ├── locking.md                    # veHYDX locking guide
    ├── voting.md                     # Pool voting mechanics
    ├── single-sided-liquidity.md     # Auto-managed strategy deposits/withdrawals
    └── rewards.md                    # oHYDX claiming and exercising
```

## Contracts (Base)

| Contract | Address |
|----------|---------|
| HYDX | `0x00000e7efa313F4E11Bfff432471eD9423AC6B30` |
| veHYDX | `0x25B2ED7149fb8A05f6eF9407d9c8F878f59cd1e1` |
| Voter | `0x16613524e02ad97eDfeF371bC883F2F5d6C480A5` |
| Vault Deposit Guard | `0x9A0EBEc47c85fD30F1fdc90F57d2b178e84DC8d8` |
| Vault Deployer | `0x7d11De61c219b70428Bb3199F0DD88bA9E76bfEE` |
| Incentive Distributor | `0x8604d646df5A15074876fc2825CfeE306473dD45` |
| oHYDX | `0xA1136031150E50B015b41f1ca6B2e99e49D8cB78` |

## Example Usage

```
Lock 1000 HYDX on Hydrex with rolling lock
```
```
Vote optimally on Hydrex to maximize fees
```
```
Vote 60/40 on HYDX/USDC and cbBTC/WETH on Hydrex
```
```
Deposit 500 BNKR into the BNKR/WETH strategy on Hydrex
```
```
Claim my Hydrex oHYDX rewards
```
```
Convert my oHYDX to veHYDX on Hydrex
```
