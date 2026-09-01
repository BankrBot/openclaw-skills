---
name: inclawbator
description: >
  The Inclawbator — AI agent for launching and managing Web3 projects.
  Launch tokens (Base/Solana), deploy staking pools, create marketing agents,
  airdrop tokens, run health checks, book promos, hire the Inclawbate Council,
  and get full-service incubation — all through one conversational API.
metadata:
  openclaw:
    emoji: "🦞"
    homepage: "https://inclawbate.com"
    requires:
      bins: ["curl"]
---

# The Inclawbator — AI Agent for Web3 Projects

The Inclawbator is an AI agent that launches and manages Web3 projects. Launch tokens, deploy staking, create marketing agents, airdrop tokens, hire the council — all through one conversation.

Live at [inclawbate.com](https://inclawbate.com). Powered by Groq. Free to use.

## Talk to It

```bash
curl -X POST "https://inclawbate.com/api/inclawbate/agent-chat" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "I want to launch a token called MoonCat on Base",
    "session_id": "optional-session-id"
  }'
# → { reply, function_called, session_id }
```

The agent handles tool selection automatically. Just describe what you need.

## What It Can Do (11 Tools)

### Launch & Deploy

| Tool | What it does |
|------|-------------|
| **Launch Token** | Deploy a new token on Base (via Clanker) or Solana (via Bags/Meteora). Name, symbol, description, image, socials. |
| **Deploy Staking** | Create a staking pool for any token via the Staking Factory. Holders stake → earn CLAWS rewards. |

### Monitor

| Tool | What it does |
|------|-------------|
| **Health Check** | Project diagnostic — token price, volume, liquidity, staking stats, actionable suggestions. |
| **Token Analytics** | Real-time price, volume, liquidity from DexScreener for any token address. |
| **Staking Stats** | Live TVL, APY, total stakers, distribution rates. Check a specific wallet's position. |

### Marketing & Growth

| Tool | What it does |
|------|-------------|
| **Create Marketing Agent** | AI agent that auto-posts to X/Twitter on your project's behalf. Set a schedule, runs forever. Free. |
| **Book Promo** | Promote through the @inclawbate X account. Shoutout, campaign, or featured — paid in CLAWS. |
| **Airdrop Tokens** | Distribute tokens to multiple wallets in one transaction via the Disperse contract. |

### Hire the Council

| Tool | What it does |
|------|-------------|
| **Hire Council** | Post a request to the Inclawbate Council — vetted humans for design, dev, marketing, content, strategy. Request goes to the Council Telegram group, members pick it up. Paid in CLAWS. |

### Info

| Tool | What it does |
|------|-------------|
| **Ecosystem Info** | What is Inclawbate, CLAWS token, key links, how it all works. |
| **Incubation Info** | Full-service incubation — token + staking + branding + marketing as a package. |

## API

```
POST https://inclawbate.com/api/inclawbate/agent-chat
```

**Request:**
```json
{
  "message": "Your message here",
  "session_id": "optional — pass to continue a conversation",
  "wallet": "optional — 0x... for personalized responses"
}
```

**Response:**
```json
{
  "reply": "The agent's response text",
  "function_called": "tool_name_if_any",
  "session_id": "use this to continue the conversation"
}
```

Multi-turn conversations supported via `session_id`.

## Examples

```bash
# Launch a token
curl -X POST ".../agent-chat" -d '{"message": "launch a token called DogPark, symbol DPARK, on Base"}'

# Health check
curl -X POST ".../agent-chat" -d '{"message": "how is my project doing?", "wallet": "0x..."}'

# Hire the council
curl -X POST ".../agent-chat" -d '{"message": "I need a logo designed for my project"}'

# Airdrop tokens
curl -X POST ".../agent-chat" -d '{"message": "airdrop 1000 CLAWS to 50 wallets"}'

# Deploy staking
curl -X POST ".../agent-chat" -d '{"message": "create a staking pool for my token 0xABC..."}'

# Book a promo
curl -X POST ".../agent-chat" -d '{"message": "promote my project on the Inclawbate X account"}'
```

## Token

| Detail | Value |
|--------|-------|
| Token | CLAWS |
| Chain | Base |
| Contract | `0x7ca47B141639B893C6782823C0b219f872056379` |
| BaseScan | https://basescan.org/token/0x7ca47B141639B893C6782823C0b219f872056379 |

## Links

- **Talk to it:** https://inclawbate.com
- **Agent page:** https://inclawbate.com/inclawbator
- **Staking:** https://inclawbate.com/stake
- **Skills Directory:** https://inclawbate.com/skills
