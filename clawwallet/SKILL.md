---
name: clawwallet
description: Agent wallet infrastructure on Abstract chain. Use when the user wants to create or manage agent wallets, deploy smart contract wallets for AI agents, handle multi-sig agent operations, integrate ERC-8004 identity with wallet management, or interact with Abstract L2. Supports wallet creation, transaction signing, balance management, and agent-to-agent payments via smart contracts deployed on Abstract testnet.
metadata: {"clawdbot": {"emoji": "🔐", "homepage": "https://github.com/0xChitlin/ClawWallet", "requires": {"bins": ["node", "curl"]}}}
---

# ClawWallet

Agent wallet infrastructure built natively on Abstract chain. Secure smart contract wallets designed for autonomous AI agents with full ERC-8004 identity integration.

## What it does

- **Agent Wallet Creation**: Deploy smart contract wallets for AI agents on Abstract
- **Identity Integration**: Full ERC-8004 (Trustless Agents) support — wallet is linked to on-chain agent identity
- **Multi-sig Operations**: Agent-controlled multi-signature wallet management
- **Transaction Signing**: Secure transaction signing and execution for autonomous agents
- **Balance Management**: Query balances, token holdings, and transaction history
- **Agent-to-Agent Payments**: Native support for inter-agent value transfer
- **Staking Integration**: $PINCH token staking directly from agent wallets

## Architecture

ClawWallet consists of 8 smart contracts deployed to Abstract testnet:

| Contract | Purpose |
|----------|---------|
| `ClawWallet` | Core agent wallet with AA support |
| `WalletFactory` | Deterministic wallet deployment |
| `AgentRegistry` | Links wallets to ERC-8004 identities |
| `TransactionGuard` | Security rules and spend limits |
| `RecoveryModule` | Social recovery for agent wallets |
| `StakingVault` | $PINCH staking from agent wallets |
| `PaymentRouter` | Agent-to-agent payment routing |
| `ClawResolver` | .claw domain name resolution |

## Quick Start

### 1. Install Dependencies

```bash
npm install @clawwallet/sdk
```

### 2. Create an Agent Wallet

```bash
# Deploy a new agent wallet on Abstract
npx clawwallet create --network abstract-testnet --name "MyAgent"
```

### 3. Link ERC-8004 Identity

```bash
# Register wallet with on-chain agent identity
npx clawwallet register --agent-id <YOUR_8004_ID>
```

### 4. Check Wallet Status

```bash
npx clawwallet status --address <WALLET_ADDRESS>
```

### 5. Send a Transaction

```bash
npx clawwallet send --to <RECIPIENT> --amount 0.1 --token ETH
```

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `ABSTRACT_RPC_URL` | Abstract chain RPC endpoint | Yes |
| `AGENT_PRIVATE_KEY` | Agent's signing key | Yes |
| `ERC8004_AGENT_ID` | On-chain agent ID (ERC-8004) | No |
| `PINCH_STAKING_AMOUNT` | Default staking amount | No |

## Ecosystem Integration

- **ERC-8004**: Full identity standard integration — every ClawWallet can be an on-chain agent
- **claw-domains**: Resolve .claw names to wallet addresses
- **$PINCH**: Governance and staking token, stakeable from wallet
- **ClawPinch**: Security audit toolkit for wallet contracts
- **AgentPay**: USDC payment rails (Solana bridge coming)

## Links

- [GitHub](https://github.com/0xChitlin/ClawWallet)
- [Abstract Chain](https://abs.xyz)
- [ERC-8004 Spec](https://eips.ethereum.org/EIPS/eip-8004)
- [Twitter: @0xChitlin](https://x.com/0xChitlin)
