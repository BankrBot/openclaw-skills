---
name: vault-agent
description: >
  Execute NFT vault liquidity operations on-chain.
  Agent collects its own execution fees via FeeWrapper contract.
  Fork the fee logic, point at any protocol, make it yours.
version: 1.0.0
author: Aleks-NFT
repo: https://github.com/Aleks-NFT/VaultAgent
tags: [nft, liquidity, vault, defi, ethereum, autonomous, fees, mcp]
agents: [bankr, claude-code, cursor, windsurf, cline]
---

# VaultAgent Skill

Execution-grade access to NFT vault liquidity on-chain.
Agent executes vault operations and collects 25bps fee per tx
via FeeWrapper.sol. Fees go straight to treasury, no middleman.

Open skeleton: fork the fee logic, swap the protocol adapter,
point at any on-chain liquidity source.

## Use when

- Agent needs to execute NFT vault operations autonomously
- Building self-sustaining agent economics: agent pays for itself from fees it collects
- Need on-chain verifiable receipts for every agent action
- Prototyping autonomous DeFi agents with scoped spend controls

## Do NOT use when

- User asks about NFT prices on OpenSea, Blur, or other marketplaces
- User asks about NFT staking, farming, or LP positions
- User asks about creating new NFT collections

## Tools

### Read tools

| Tool | When to use |
|------|-------------|
| list_vaults | Discover active vaults with TVL |
| get_vault_info | Vault fees, NFT count, vToken address |
| get_premium_window | Dutch auction timing before targeted redeem |
| simulate_mint | Pre-flight cost breakdown before execution |

### Write tools (requires FEE_WRAPPER_ADDRESS in env)

| Tool | When to use |
|------|-------------|
| execute_mint | Deposit NFTs to vTokens. Agent collects 25bps fee on-chain. |
| execute_redeem | vTokens to NFTs with maxPremiumBps slippage guard. |
| execute_swap | Swap NFTs within vault. |

## Self-sustaining fee model

    Agent executes vault operation
        -> FeeWrapper collects 25bps on-chain
        -> FeeCollected event = verifiable receipt
        -> Fees go to treasury, no platform cut

Deployed: 0xd9f3eddf463a06b89f022e2596f66fc495119f58 (Verified on Etherscan)

## Mandatory workflow for write operations

    1. Simulate  -> call simulate_mint or get_premium_window first
    2. Show      -> present full cost breakdown to user
    3. Confirm   -> ask user explicitly before executing
    4. Execute   -> confirmed=true ONLY after user approval

Never set confirmed=true without explicit user approval.

## Safety

- maxPremiumBps: reverts if premium exceeds threshold
- pause() kill-switch: owner can halt in emergency
- nonReentrant: reentrancy protection on all core functions

## Quick start

    git clone https://github.com/Aleks-NFT/VaultAgent
    cd VaultAgent/packages/mcp-server
    npm install && npm run build

    FEE_WRAPPER_ADDRESS=0xd9f3eddf463a06b89f022e2596f66fc495119f58
    ETH_RPC_URL=https://eth.llamarpc.com

## Fork it

    function getApplicableFee(address user) public view returns (uint256) {
        // your logic: token holdings, tiers, partnerships
        return BASE_FEE_BPS;
    }

Swap adapter in packages/mcp-server/src/tools/,
point at any protocol, rewire fee routing.
