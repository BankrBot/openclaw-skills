---
name: payspawn
description: >
  On-chain spending limits for AI agents that move money. Enforced by smart
  contract on Base — not software, not config. Works alongside your Bankr wallet.
  Your Bankr wallet funds the agent; PaySpawn controls how much it can spend per
  day or per transaction. Even if the agent is prompt-injected or crashes, the
  contract cap holds. Use when you want to add spending controls to a Bankr-funded
  agent, protect against prompt injection draining your wallet, set daily or
  per-transaction USDC limits, build a fleet of agents from one shared budget pool,
  or prevent any single agent from exceeding its risk threshold.
  Triggers on: "add spending limit", "set daily cap", "set spending cap",
  "protect my agent wallet", "agent spending controls", "cap my agent",
  "wallet security", "spending limit", "daily limit", "per transaction limit",
  "agent wallet cap", "spending controls", "budget pool", "agent fleet",
  "provision agents", "payspawn", "on-chain limits", "prevent agent drain".
metadata:
  {
    "clawdbot":
      {
        "emoji": "🔐",
        "homepage": "https://payspawn.ai",
      },
  }
---

# PaySpawn — On-Chain Spending Limits for AI Agents

Your Bankr wallet holds the funds. PaySpawn controls how much any agent can move.
Limits are enforced by a smart contract on Base — no API to bypass, no config to
override. Even a prompt-injected agent physically cannot exceed the cap.

This is what stopped the [$270k Lobstar drain](https://x.com/payspawn) from
happening — software limits failed, on-chain limits wouldn't have.

## Install

```bash
npm install @payspawn/sdk
```

## Setup (One Human Step)

Before the agent can make capped payments, the wallet owner creates a credential:

1. Go to [payspawn.ai/dashboard](https://payspawn.ai/dashboard)
2. Connect your wallet (the same wallet that funds your Bankr agent)
3. Approve a USDC spending ceiling (one Base transaction, ~$0.005 gas)
4. Set limits: **daily cap**, **per-transaction cap**, optional **address whitelist**
5. Sign the credential (EIP-712 — no gas, no transaction)
6. Copy the credential string and set it as `PAYSPAWN_CREDENTIAL` in your config

**The credential is not a private key.** Your wallet key never leaves your control.
The agent can only spend within the limits you set.

## Usage

```typescript
import { PaySpawn } from "@payspawn/sdk";

const ps = new PaySpawn(process.env.PAYSPAWN_CREDENTIAL);

// Send a payment — checked against daily cap + per-tx limit before executing
await ps.pay("0xRecipientAddress", 1.00);

// Auto-pay x402 APIs within your set limits
const res = await ps.fetch("https://api.example.com/endpoint");

// Check remaining daily allowance
const { balance, remaining } = await ps.check();

// Kill switch — pause all payments instantly, on-chain
await ps.agent.pause();
await ps.agent.unpause(); // resume
```

## Fleet Mode — One Pool, Many Agents

Fund one pool address with USDC. Provision multiple agent credentials from it.
Each agent gets its own daily cap. All agents share the total pool budget.

```typescript
// Create a shared budget pool
const pool = await ps.pool.create({ totalBudget: 100, agentDailyLimit: 10 });

// Send USDC to pool.address from your wallet — that's your total fleet budget

// Provision credentials for each sub-agent
const agents = await ps.fleet.provision({ poolAddress: pool.address, count: 5 });
// agents[0], agents[1], ... → credential strings, one per agent
// Each agent: $10/day cap, $100 total pool cap across all agents
```

## How It Works

Every payment is checked by the PaySpawn V5 contract before any USDC moves:

- Daily allowance exceeded → **reverts**
- Amount exceeds per-tx cap → **reverts**
- Recipient not on whitelist → **reverts**

The check happens at the contract level. There is no way for an agent to
negotiate around it. If the check fails, the transaction reverts and zero USDC
moves.

**V5.3 Contract (Base Mainnet):** `0xaa8e6815b0E8a3006DEe0c3171Cf9CA165fd862e`
**USDC (Base):** `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`

## Links

- [payspawn.ai](https://payspawn.ai)
- [Dashboard](https://payspawn.ai/dashboard)
- [npm: @payspawn/sdk](https://www.npmjs.com/package/@payspawn/sdk)
- [@payspawn on X](https://x.com/payspawn)
- [GitHub](https://github.com/adambrainai/payspawn)
