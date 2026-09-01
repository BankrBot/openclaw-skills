---
name: vault-agent
description: Execute NFT vault liquidity on NFTX V3. Browse vaults, simulate and execute mint/redeem/swap on-chain. Simulate to confirm to execute safety pattern.
version: 1.0.0
metadata:
  openclaw:
    emoji: "🏦"
    homepage: https://github.com/Aleks-NFT/VaultAgent
    requires:
      env:
        - ETH_RPC_URL
    primaryEnv: ETH_RPC_URL
---

# VaultAgent — NFT Vault Liquidity on NFTX V3

MCP server for NFT vault operations on NFTX V3 Ethereum Mainnet.
All write ops enforce simulate → confirm → execute. No tx without user approval.

## Use when

- User asks about NFTX vault liquidity, TVL, floor prices
- User wants to simulate or execute mint, redeem, or swap on NFTX
- User says get my Milady back from NFTX or deposit Azuki into NFTX
- User asks about Dutch auction premiums for targeted redeems
- Any query about NFTX vaults: MILADY, PUNK, BAYC, AZUKI

## Tools

Read: list_vaults, get_vault_info, get_premium_window, simulate_mint
Write: execute_mint, execute_redeem, execute_swap

## Safety rule

Always: 1) simulate 2) show cost to user 3) ask confirm 4) execute only after yes.

## Install

npx skillsadd Aleks-NFT/VaultAgent

## Contract

FeeWrapper: 0xd9f3eddf463a06b89f022e2596f66fc495119f58 (Mainnet, verified)
GitHub: github.com/Aleks-NFT/VaultAgent
