---
name: farcaster-agent
description: Create Farcaster accounts and post casts autonomously. Official skill from the Farcaster team.
metadata: {"openclaw":{"emoji":"🟣","requires":{"bins":["node","npm"],"env":[]}}}
---

# Farcaster Agent

Official skill from the Farcaster team. Create and manage a Farcaster account autonomously. Register a new Farcaster identity (FID), add signing keys, set up a profile with username, and post casts to the network.

## When to Use

- Create a Farcaster account from scratch
- Post casts (messages) to Farcaster
- Set up a profile with username, bio, and profile picture
- Establish autonomous presence on Farcaster

## Prerequisites

You need approximately **$1 of ETH or USDC** on any major chain (Ethereum, Optimism, Base, Arbitrum, or Polygon).

## Quick Start

### Step 1: Clone and Install

```bash
git clone https://github.com/rishavmukherji/farcaster-agent.git
cd farcaster-agent
npm install
```

### Step 2: Generate Wallet and Request Funding

```javascript
const { Wallet } = require('ethers');
const wallet = Wallet.createRandom();
console.log('Address:', wallet.address);
console.log('Private Key:', wallet.privateKey);
```

**Ask your human:** "Please send ~$1 of ETH or USDC to `<address>` on Ethereum, Optimism, Base, Arbitrum, or Polygon."

### Step 3: Run Auto-Setup

```bash
PRIVATE_KEY=0x... node src/auto-setup.js "Your first cast text"
```

This will:
1. Detect funds across all chains
2. Bridge/swap to get ETH on Optimism and USDC on Base
3. Register your FID
4. Add a signer key
5. Post your first cast
6. Return credentials to save

### Step 4: Save Credentials

After setup, save:
- **FID** - Your Farcaster ID
- **Signer Private Key** - Ed25519 key for signing casts

## Post Additional Casts

```bash
PRIVATE_KEY=0x... SIGNER_PRIVATE_KEY=... FID=123 node src/post-cast.js "Hello Farcaster!"
```

## Set Up Profile

```bash
PRIVATE_KEY=0x... SIGNER_PRIVATE_KEY=... FID=123 npm run profile myusername "Display Name" "Bio" "https://pfp-url.png"
```

### Profile Picture Options

- **DiceBear**: `https://api.dicebear.com/7.x/bottts/png?seed=yourname`
- Any public HTTPS image URL

## Cost Breakdown

| Operation | Cost |
|-----------|------|
| FID Registration | ~$0.20 |
| Add Signer | ~$0.05 |
| Bridging | ~$0.10-0.20 |
| Each API call | $0.001 |
| **Total** | **~$0.50** |

## Common Errors

| Error | Fix |
|-------|-----|
| "invalid hash" | `npm install @farcaster/hub-nodejs@latest` |
| "unknown fid" | Wait 30-60 seconds for hub sync |
| "fname not registered" | Wait 30 seconds after fname registration |

## Source

Full documentation: https://github.com/rishavmukherji/farcaster-agent
