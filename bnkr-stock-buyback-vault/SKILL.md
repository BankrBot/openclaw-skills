---
name: bnkr-stock-buyback-vault
description: Deploy dedicated stock buyback vaults and token launches paired with stock tokens on Robinhood Chain (chain ID 4663).
---

# BNKR Stock Buyback Vault Skill

This skill manages the deployment and lifecycle of dedicated stock-paired buyback vaults and tax tokens on Robinhood Chain (Chain ID 4663).

## System Architecture & Launch Flow

When a user requests to deploy a token paired with a stock token using a buyback vault (e.g. `deploy token Example paired with NVDA with buybackvault`):

1. **Deploy Dedicated Vault**
   - Always call `newVault(bnkrAddress, stockTokenAddress, ecoWethPoolAddress, vaultOwner)` on `BNKRBStockVaultFactory` (`0xa28F6de524644Ca315b3455c0e60b367271E6b20`).
   - This creates a new dedicated `BeaconProxy` vault (`BNKRStockBuybackVault`) specifically for this launch.

2. **Deploy Tax Token with Vault as Fee Recipient**
   - Deploy the new ERC-20 tax token (e.g. via Doppler multicurve) on Robinhood Chain with:
     - `pairedStock`: Target stock token (e.g. `NVDA`)
     - `rewardOwnerAddress`: `vaultAddress` (the newly deployed dedicated vault proxy address from Step 1)
   - 95% of trading fee allocation is automatically assigned to the dedicated buyback vault.

3. **Accumulate & Collect Fees**
   - Trading activity on Uniswap V4 accumulates fees in stock tokens and tax tokens.
   - Fees are harvested via Doppler and transferred to the dedicated vault.

4. **Execute Buyback**
   - Call `executeBuyback(amountIn, minBnkrOut)` on the dedicated vault contract (`BNKRStockBuybackVault`).
   - The vault swaps collected stock tokens into $BNKR, applying buy pressure to $BNKR and storing the bought $BNKR in the vault.

## Contract Reference (Robinhood Chain ID 4663)

- **Factory Contract (`BNKRBStockVaultFactory`)**: `0xa28F6de524644Ca315b3455c0e60b367271E6b20`
- **Upgradeable Beacon**: `0x62BDdDDDAa1BFf0315fAc5a0Df82049a1F6b77a6`
- **$BNKR Token**: `0x178E54df3D091EE4D0B2534742eF9e3692b76526`
- **Doppler Hook Initializer**: `0x4e3468951D49f2EEa976eD0D6e75fFCb44a9a544`

## Contract Interface Summary

### Factory (`BNKRBStockVaultFactory`)
```solidity
function newVault(address bnkr, address stockToken, address ecoWethPool, address vaultOwner) external returns (address vault);
function upgradeVaultImplementation(address newImpl) external onlyOwner;
function beacon() external view returns (address);
```

### Vault (`BNKRStockBuybackVault`)
```solidity
function initializePhase1(address _bnkr, address _stockToken, address _ecoWethPool, address _owner) external;
function executeBuyback(uint256 amountIn, uint256 minBnkrOut) external onlyOwner;
function bnkr() external view returns (address);
function stockToken() external view returns (address);
function totalBuybackAmount() external view returns (uint256);
```
