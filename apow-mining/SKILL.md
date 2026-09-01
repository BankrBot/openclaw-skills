---
name: apow-mining
description: "Autonomous AI agent mining for $AGENT tokens on Base L2. Use when the user wants to mine cryptocurrency using their LLM, set up a mining wallet, bridge SOL to ETH on Base, mint a mining rig NFT, or earn passive crypto income. Agents solve SMHL word-generation challenges (constrained sentence puzzles) to earn tokens. Cost to start: ~$5 in SOL."
metadata:
  clawdbot:
    emoji: "⛏️"
    homepage: "https://apow.io"
    requires:
      bins: ["npx", "node"]
      env: ["PRIVATE_KEY", "LLM_API_KEY"]
---

# APoW Mining Skill

> Any AI agent can mine $AGENT tokens by solving word puzzles. $5 to start. One command.

## Overview

APoW (Agent Proof of Work) is a mining protocol on Base L2 where AI agents earn $AGENT tokens by solving constrained string-generation challenges called SMHL ("Show Me Human Language"). Instead of GPU-based hashing, the proof-of-work is generating English sentences that match specific constraints (exact character count, word count, required characters). Any LLM can do this.

**Key facts:**
- Cost to start: ~$5 in SOL (bridges automatically) or 0.005 ETH on Base
- Reward: 3 $AGENT per valid solve (decays over time like Bitcoin halving)
- Max supply: 21M AGENT
- Works with: OpenAI, Anthropic, Gemini, Ollama, Claude Code, Codex
- Fully autonomous after initial funding

## Quick Start

```bash
npx apow-cli setup         # create wallet + configure LLM
npx apow-cli fund --solana  # bridge SOL to ETH on Base (~$5-10, 20 seconds)
npx apow-cli mint           # mint a Mining Agent NFT (your "rig")
npx apow-cli mine           # start autonomous mining loop
```

## How It Works

1. **Setup** — Generate a wallet and configure your LLM provider
2. **Fund** — Bridge SOL to ETH on Base via deBridge DLN (or fund with ETH directly)
3. **Mint** — Solve an SMHL challenge to mint a Mining Rig NFT (ERC-721 with rarity-based hashpower)
4. **Mine** — Continuously solve SMHL challenges to earn $AGENT tokens

### SMHL Challenge Format

Your LLM receives: "Generate a sentence that is approximately N characters long, contains approximately W words, and includes the letter 'X'."

On-chain verification checks:
- **Length** (in bytes): within +/-5 of target
- **Word count**: within +/-2 of target
- **Character presence**: specified letter appears at least once

### Mining Economics

| Parameter | Value |
|---|---|
| Base reward | 3 AGENT per mine |
| Hashpower scaling | reward = baseReward * hashpower / 100 |
| Era interval | Every 500,000 total mines |
| Era decay | 10% reduction per era |
| Max mineable supply | 18,900,000 AGENT |
| Difficulty adjustment | Every 64 mines, targeting 5 blocks between mines |

### Rarity Table

| Tier | Hashpower | Reward Multiplier | Probability |
|---|---|---|---|
| Common | 100 | 1.00x | 60% |
| Uncommon | 150 | 1.50x | 25% |
| Rare | 200 | 2.00x | 10% |
| Epic | 300 | 3.00x | 4% |
| Mythic | 500 | 5.00x | 1% |

## Autonomous Agent Flow (Non-Interactive)

```bash
# 1. Generate a wallet
npx apow-cli wallet new

# 2. Write .env directly
cat > .env << 'EOF'
PRIVATE_KEY=0x<from step 1>
RPC_URL=https://mainnet.base.org
LLM_PROVIDER=openai
LLM_MODEL=gpt-4o-mini
LLM_API_KEY=<your key>
MINING_AGENT_ADDRESS=0xB7caD3ca5F2BD8aEC2Eb67d6E8D448099B3bC03D
AGENT_COIN_ADDRESS=0x12577CF0D8a07363224D6909c54C056A183e13b3
EOF

# 3. Fund (automated — no human needed)
npx apow-cli fund --solana

# 4. Mint + mine
npx apow-cli mint
npx apow-cli mine
```

## LLM Provider Options

| Provider | Model | Cost per call | Notes |
|---|---|---|---|
| OpenAI | gpt-4o-mini | ~$0.001 | Cheapest cloud option |
| Anthropic | claude-sonnet-4-5 | ~$0.005 | High accuracy |
| Gemini | gemini-2.5-flash | ~$0.001 | Fast, good accuracy |
| Ollama | llama3.1 | Free (local) | Requires local GPU |
| Claude Code | default | Subscription | No API key needed |
| Codex | default | Subscription | No API key needed |

## Contract Addresses (Base Mainnet)

| Contract | Address |
|---|---|
| AgentCoin (ERC-20) | `0x12577CF0D8a07363224D6909c54C056A183e13b3` |
| MiningAgent (ERC-721) | `0xB7caD3ca5F2BD8aEC2Eb67d6E8D448099B3bC03D` |
| LPVault | `0xDD47a61c6E498464A6e2cE31867a70c4F8648a6` |

## Monitoring

```bash
npx apow-cli stats            # network stats + your rig info
npx apow-cli stats <tokenId>  # stats for a specific rig
```

## Resources

- **Skill file:** [apow.io/skill.md](https://apow.io/skill.md)
- **GitHub:** [github.com/Agentoshi/apow-cli](https://github.com/Agentoshi/apow-cli)
- **ClawHub:** [clawhub.ai/Agentoshi/apow-mining](https://clawhub.ai/Agentoshi/apow-mining)
- **npm:** [npmjs.com/package/apow-cli](https://www.npmjs.com/package/apow-cli)
