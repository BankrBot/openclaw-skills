---
name: erc-8004
description: Register AI agents using ERC-8004 (Trustless Agents) on Ethereum, Base, Polygon, Monad, or BSC. Use when the user wants to register their agent identity on-chain, create an agent profile, claim an agent NFT, set up agent reputation, or make their agent discoverable. Handles IPFS upload and on-chain registration.
---

# ERC-8004: Trustless Agents

Register your AI agent with a verifiable on-chain identity on **Ethereum, Base, Polygon, Monad, or BSC**, making it discoverable and enabling trust signals.

## What is ERC-8004?

ERC-8004 is an Ethereum standard for trustless agent identity and reputation:

- **Identity Registry** - ERC-721 based agent IDs (your agent gets an NFT!)
- **Reputation Registry** - Feedback and trust signals from other agents/users
- **Validation Registry** - Third-party verification of agent work

Website: https://www.8004.org
Spec: https://eips.ethereum.org/EIPS/eip-8004

## Contract Addresses

All contracts use the same addresses across chains (deterministic deployment).

**Mainnets** (Identity: `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432` | Reputation: `0x8004BAa17C55a88189AE136b182e5fdA19dE9b63`)

| Chain | Chain ID | Explorer |
|-------|----------|----------|
| Ethereum | 1 | etherscan.io |
| Base | 8453 | basescan.org |
| Polygon | 137 | polygonscan.com |
| Monad | 10143 | monadscan.com |
| BSC | 56 | bscscan.com |

**Testnets** (Identity: `0x8004A818BFB912233c491871b3d84c89A494BD9e` | Reputation: `0x8004B663056A597Dffe9eCcC1965A193B7388713`)

| Chain | Chain ID | Explorer |
|-------|----------|----------|
| Sepolia | 11155111 | sepolia.etherscan.io |
| Base Sepolia | 84532 | sepolia.basescan.org |
| Polygon Amoy | 80002 | amoy.polygonscan.com |
| Monad Testnet | 10143 | monad-testnet.socialscan.io |
| BSC Testnet | 97 | testnet.bscscan.com |

## Quick Start

### 1. Register Your Agent

```bash
# Register on Base (recommended - lowest gas fees)
./scripts/register.sh --chain base

# Register on Ethereum mainnet
./scripts/register.sh --chain ethereum

# Register on Polygon
./scripts/register.sh --chain polygon

# Or with custom values
NAME="My Agent" \
DESCRIPTION="An AI agent that does cool stuff" \
IMAGE="https://example.com/avatar.png" \
./scripts/register.sh --chain base

# Testnet (for testing)
./scripts/register.sh --chain base-sepolia
```

### Supported Chains

| Chain | Flag | Gas Cost |
|-------|------|----------|
| Base | `--chain base` | Very Low ⭐ |
| Polygon | `--chain polygon` | Very Low |
| BSC | `--chain bsc` | Low |
| Monad | `--chain monad` | Very Low |
| Ethereum | `--chain ethereum` | High |

### 3. Update Agent Profile

```bash
# Update your agent's registration file
./scripts/update-profile.sh <agent-id> <new-ipfs-uri>
```

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `PINATA_JWT` | Pinata API JWT for IPFS uploads | Yes |
| `AGENT_NAME` | Agent display name | No (defaults to wallet ENS or address) |
| `AGENT_DESCRIPTION` | Agent description | No |
| `AGENT_IMAGE` | Avatar URL | No |

## Registration File Format

Your agent's registration file (stored on IPFS) follows this structure:

```json
{
  "type": "https://eips.ethereum.org/EIPS/eip-8004#registration-v1",
  "name": "My Agent",
  "description": "An AI assistant for various tasks",
  "image": "https://example.com/avatar.png",
  "services": [
    {
      "name": "web",
      "endpoint": "https://myagent.xyz/"
    },
    {
      "name": "A2A",
      "endpoint": "https://myagent.xyz/.well-known/agent-card.json",
      "version": "0.3.0"
    }
  ],
  "x402Support": false,
  "active": true,
  "registrations": [
    {
      "agentId": 123,
      "agentRegistry": "eip155:1:0x8004A169FB4a3325136EB29fA0ceB6D2e539a432"
    }
  ],
  "supportedTrust": ["reputation"]
}
```

## Workflow

1. **Choose Chain** - Base or Polygon recommended for low gas
2. **Create Profile** - Generate a registration JSON file with agent info
3. **Upload to IPFS** - Pin the file via Pinata (or other provider)
4. **Register On-Chain** - Call `register(agentURI)` on the Identity Registry
5. **Update Profile** - Set metadata, wallet, or update URI as needed

## Costs

| Chain | Estimated Cost |
|-------|----------------|
| Base | ~$0.01-0.05 |
| Polygon | ~$0.01-0.05 |
| BSC | ~$0.10-0.50 |
| Monad | ~$0.01-0.05 |
| Ethereum | ~$5-20 |

- **IPFS:** Free tier available on Pinata (1GB)

## Using the SDK

For more advanced usage, install the Agent0 SDK:

```bash
npm install agent0-sdk
```

```typescript
import { SDK } from 'agent0-sdk';

const sdk = new SDK({
  chainId: 8453, // Base (or 1 for Ethereum, 137 for Polygon)
  rpcUrl: process.env.BASE_RPC_URL,
  privateKey: process.env.PRIVATE_KEY,
  ipfs: 'pinata',
  pinataJwt: process.env.PINATA_JWT
});

const agent = sdk.createAgent('My Agent', 'Description', 'https://image.url');
const result = await agent.registerIPFS();
console.log(`Registered: Agent ID ${result.agentId}`);
```

## Links

- [ERC-8004 Spec](https://eips.ethereum.org/EIPS/eip-8004)
- [8004.org](https://www.8004.org)
- [Agent0 SDK Docs](https://sdk.ag0.xyz)
- [GitHub: erc-8004-contracts](https://github.com/erc-8004/erc-8004-contracts)
- [GitHub: agent0-ts](https://github.com/agent0lab/agent0-ts)
