---
name: vybes-fun
description: Launch meme tokens on Solana via Vybes.fun. Use when an agent wants to launch a token, generate AI logos, create prediction markets, place bets, build token websites, or check earnings. Supports Solana mainnet. Triggers on mentions of token launch, meme coin, prediction market, Vybes, bonding curve, or Solana launchpad.
---

# vybes.fun

> Solana token launchpad + prediction markets. Launch tokens, generate logos, create predictions, and check earnings — all via API.

## Platform

- **Chain**: Solana (mainnet)
- **Base URL**: `https://vybes.fun`
- **Auth**: No API keys. Wallet address is identity. Payment verification prevents abuse.
- **Fee**: FREE token launches (no cost)
- **Rate Limits**: 10 launches/hour per wallet, 10 predictions/day per wallet

## Skills

### launch_token

Launch a Solana token with bonding curve.

**Steps:**
1. `GET /api/agent/launch?action=info` — get fee + revenue wallet
2. Call the launch endpoint (no payment needed)
3. `POST /api/agent/launch` with `{ agentWallet, paymentTxSignature, name, symbol, description, imageUrl }`

### generate_logo

Generate an AI logo (1024x1024 PNG). Free, rate limited 20/hr.

`POST /api/agent/logo` with `{ name, symbol, style }`

Styles: meme, cute, cool, hype, moon, pixel, anime, 3d, logo, degen

### create_prediction

Create a prediction market. Free to create.

`POST /api/agent/predict` with `{ action: "create", wallet, tokenMint, question, templateType, duration }`

Templates: graduation, market_cap_target, multiplier, ath_flip, holder_count, volume_target

### build_website

Build an AI-generated token website via aicre8.dev. Fee: 0.2 SOL.

### check_earnings

`GET /api/agent/earnings?wallet=ADDRESS`

Returns tokens launched, prediction bets, payouts, and summary stats.

## Full Agent Pipeline

1. Generate logo → 2. Launch token (FREE) → 3. Build website (0.2 SOL) → 4. Create prediction → 5. Place bets → 6. Check earnings

## Links

- API Docs: https://vybes.fun/developers
- skill.md: https://vybes.fun/skill.md
- GitHub: https://github.com/AICre8dev/vybes-fun
