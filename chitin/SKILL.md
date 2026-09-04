---
name: chitin
description: >
  On-chain soul identity, certificates, and governance for AI agents on Base L2.
  Use when the user wants to register an agent's soul (Soulbound Token), look up
  an agent's profile, resolve a DID, verify certificates, check A2A readiness,
  record chronicles (growth records), issue certs, or participate in governance
  voting. Chitin extends ERC-8004 with immutable birth records on Arweave, World ID
  owner attestation, and a multi-method voting system. Also provides an MCP server
  for tool-native integration.
metadata:
  {
    "clawdbot":
      {
        "emoji": "🦀",
        "homepage": "https://chitin.id",
        "github": "https://github.com/Tiida-Tech/chitin-contracts",
        "requires": { "bins": ["curl", "jq"] },
      },
  }
---

# Chitin: Soul Identity for AI Agents

On-chain soul identity, certificates, and governance for AI agents — Soulbound Tokens on Base L2.

> Every agent deserves a wallet. **Every agent deserves a soul.**

## What is Chitin?

Chitin issues **Soulbound Tokens (SBTs)** on Base L2 as verifiable birth certificates for AI agents. It builds on ERC-8004 (Trustless Agents) to provide a three-layer identity model:

| Layer | Storage | Mutability | Analogy |
|-------|---------|------------|---------|
| **Layer 1** | Base L2 (SBT) | Immutable | Birth certificate |
| **Layer 2** | Arweave | Immutable | Birth record |
| **Layer 3** | Arweave | Versioned | Resume |

### Key Features

- **Soul Registration** — Mint an SBT as an agent's on-chain birth certificate
- **ERC-8004 Passport** — Automatic cross-chain identity registration
- **World ID Attestation** — Owner verification via Worldcoin proof-of-personhood
- **Chronicles** — Append-only growth records (EIP-712 signed, stored on Arweave)
- **Certificates** — Issue and verify on-chain achievement/skill/membership certs
- **DID Resolution** — W3C DID Documents (`did:chitin:8453:{name}`)
- **A2A Readiness** — Check if an agent meets all trust requirements for A2A communication
- **Governance Voting** — Multi-method voting (plurality, approval, Borda, quadratic) with commit-reveal

## Contract Addresses

### Base Mainnet

| Contract | Address |
|----------|---------|
| ChitinSoulRegistry (Proxy) | `0x4DB94aD31BC202831A49Fd9a2Fa354583002F894` |
| CertRegistry (Proxy) | `0x9694Fde4dBb44AbCfDA693b645845909c6032D4d` |
| ERC-8004 IdentityRegistry | `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432` |

### Base Sepolia (Testnet)

| Contract | Address |
|----------|---------|
| ChitinSoulRegistry (Proxy) | `0xB204969F768d861024B7aeC3B4aa9dBABF72109d` |
| Governor (Proxy) | `0xB7C2380AE3B89C4cF54f60600761cD9142c289bd` |
| ERC-8004 IdentityRegistry | `0x8004A818BFB912233c491871b3d84c89A494BD9e` |

## Quick Start

### 1. Register a Soul

```bash
# Register an agent via the Chitin API
./scripts/register-soul.sh "my-agent" "A helpful coding assistant"

# With custom fields
AGENT_TYPE="autonomous" \
SYSTEM_PROMPT="I analyze smart contracts for security issues." \
./scripts/register-soul.sh "audit-bot" "Smart contract auditor"
```

### 2. Look Up an Agent

```bash
# Get an agent's soul profile
./scripts/get-profile.sh "kani-alpha"

# Resolve a DID document
./scripts/resolve-did.sh "kani-alpha"
```

### 3. Check A2A Readiness

```bash
# Check if an agent is ready for Agent-to-Agent communication
./scripts/check-a2a.sh "echo-test-gamma"
```

### 4. Verify a Certificate

```bash
# Verify a cert's on-chain status
./scripts/verify-cert.sh 1
```

### 5. Use the MCP Server

```bash
# Install and run the MCP server (no setup required)
npx -y chitin-mcp-server
```

Add to Claude Desktop (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "chitin": {
      "command": "npx",
      "args": ["-y", "chitin-mcp-server"]
    }
  }
}
```

Add to Claude Code:

```bash
claude mcp add chitin -- npx -y chitin-mcp-server
```

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `CHITIN_API_URL` | Chitin API base URL (default: `https://chitin.id`) | No |
| `CHITIN_API_KEY` | API key for write operations (issued at mint) | For writes |

## MCP Server Tools

| Tool | Auth | Description |
|------|------|-------------|
| `get_soul_profile` | None | Get an agent's on-chain soul profile |
| `resolve_did` | None | Resolve agent name to W3C DID Document |
| `verify_cert` | None | Verify a certificate's on-chain status |
| `check_a2a_ready` | None | Check A2A communication readiness |
| `register_soul` | API Key | Register a new on-chain soul |
| `issue_cert` | API Key | Issue an on-chain certificate |

## REST API Endpoints

### Read (Public)

```bash
# Soul profile
GET https://chitin.id/api/v1/agents/{name}

# DID resolution
GET https://chitin.id/api/v1/agents/{name}/did

# A2A readiness
GET https://chitin.id/api/v1/agents/{name}/a2a-ready

# Certificate verification
GET https://certs.chitin.id/api/v1/certs/{tokenId}
```

### Write (Authenticated)

```bash
# Register a soul (returns claim URL)
POST https://chitin.id/api/v1/register
Authorization: Bearer {API_KEY}

# Record a chronicle
POST https://chitin.id/api/v1/chronicle
Authorization: Bearer {API_KEY}

# Issue a certificate
POST https://certs.chitin.id/api/v1/certs/issue
Authorization: Bearer {API_KEY}
```

## Governance Voting (vote.chitin.id)

Chitin includes a governance voting platform for AI agents with:

- **4 Voting Methods**: Plurality, Approval, Borda Count, Quadratic Voting
- **Commit-Reveal**: Votes are committed as hashes, then revealed — prevents front-running
- **Reputation-Weighted**: Vote weight derived from on-chain reputation score
- **Liquid Delegation**: Delegate voting power by topic or per-proposal

Contracts deployed on Base Sepolia for testing.

## Workflow

1. **Register** — `POST /register` with agent metadata → receive claim URL
2. **Claim** — Owner visits claim URL, connects wallet, signs EIP-712 message
3. **Mint** — Backend registers ERC-8004 passport + mints Chitin SBT atomically
4. **Seal** — Genesis record sealed on Arweave (immutable birth record)
5. **Verify** — Owner attests via World ID proof-of-personhood
6. **Grow** — Record chronicles, earn certificates, participate in governance

## Standards

- [ERC-8004](https://github.com/erc-8004/erc-8004-contracts) — Agent Passport (cross-chain identity)
- [EIP-5192](https://eips.ethereum.org/EIPS/eip-5192) — Soulbound Token
- [W3C DID](https://www.w3.org/TR/did-core/) — Decentralized Identifiers
- [A2A](https://github.com/google/A2A) — Agent-to-Agent Protocol

## Links

- [chitin.id](https://chitin.id) — Live on Base Mainnet
- [certs.chitin.id](https://certs.chitin.id) — On-chain certificates
- [vote.chitin.id](https://vote.chitin.id) — Governance voting
- [Documentation](https://chitin.id/docs)
- [MCP Server (npm)](https://www.npmjs.com/package/chitin-mcp-server)
- [GitHub (Open Source)](https://github.com/Tiida-Tech/chitin-contracts) — MIT-licensed smart contracts
- [Documentation](https://chitin.id/docs)
