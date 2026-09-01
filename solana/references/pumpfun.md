# Pump.fun Token Launching

Deploy memecoins on Solana's leading fair-launch platform.

## Overview

Pump.fun is the Clanker of Solana - a fair launch platform where anyone can create tokens with automatic liquidity bootstrapping via bonding curves.

**How it works:**
1. Create token with metadata
2. Bonding curve provides initial liquidity
3. Trading begins immediately
4. At ~$69k market cap, token "graduates" to Raydium
5. Creators earn 1% of trading fees post-graduation

## Token Creation

### Required Parameters

| Parameter | Description | Example |
|-----------|-------------|---------|
| name | Full token name | "Moon Cat" |
| symbol | Ticker, 2-10 chars | "MCAT" |

### Optional Parameters

| Parameter | Description | Example |
|-----------|-------------|---------|
| description | Token description | "The next big cat coin" |
| image | Logo (URL or base64) | "https://..." |
| twitter | Twitter handle | "@mooncat" |
| telegram | Telegram group | "t.me/mooncat" |
| website | Project website | "mooncat.xyz" |

## Prompt Examples

**Basic launch:**
- "Launch a token called DOGE2 with symbol D2 on pump.fun"
- "Create pump.fun token: SuperFrog (SFROG)"

**With metadata:**
- "Deploy on pump.fun: name=Galaxy Cat, symbol=GCAT, description=Cats from space"
- "Launch memecoin with twitter @mytoken and telegram t.me/mytoken"

**With image:**
- "Create pump.fun token PEPE2 with this image: [url]"

## Costs

| Item | Cost |
|------|------|
| Creation | ~0.02 SOL |
| First buy (optional) | Variable |
| Trading fee | 1% (to creator post-graduation) |

## Token Lifecycle

### 1. Bonding Curve Phase
- Price determined by bonding curve math
- Early buyers get lower prices
- Liquidity locked in curve

### 2. Graduation (~$69k mcap)
- Liquidity migrates to Raydium
- Normal AMM trading begins
- Creator fees activate

### 3. Post-Graduation
- 1% creator fee on all trades
- Claimable anytime
- No expiration

## Checking Token Status

```bash
scripts/solana-native.sh pumpfun status <token_mint>
```

Returns:
- Current price
- Market cap
- Bonding curve progress
- Graduation status

## Claiming Creator Fees

```bash
scripts/solana-native.sh pumpfun claim <token_mint>
```

Only works if:
- You're the token creator
- Token has graduated
- Unclaimed fees exist

## API Endpoints

### Create Token
```bash
curl -X POST "https://pumpportal.fun/api/trade" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "create",
    "name": "Token Name",
    "symbol": "TICK",
    "description": "Description",
    "imageUrl": "https://...",
    "twitter": "@handle",
    "telegram": "t.me/group",
    "website": "https://..."
  }'
```

### Get Token Info
```bash
curl "https://frontend-api.pump.fun/coins/<mint_address>"
```

## Best Practices

1. **Prepare metadata first** - Have name, symbol, description, image ready
2. **Test on devnet** - pump.fun has devnet support
3. **Promote immediately** - Bonding curve rewards early buyers
4. **Monitor graduation** - Big moment for your token
5. **Claim fees regularly** - Don't leave money on the table

## Risks

- **Rug risk for buyers** - Creators can sell anytime
- **No refunds** - Bonding curve is one-way
- **Competition** - Thousands of tokens launch daily
- **Graduation not guaranteed** - Many tokens never reach $69k

## Comparison with Clanker (Base)

| Feature | Pump.fun (Solana) | Clanker (Base) |
|---------|-------------------|----------------|
| Launch cost | ~0.02 SOL | Gas fees |
| Initial liquidity | Bonding curve | Uniswap pool |
| Graduation | $69k mcap | N/A |
| Creator fees | 1% post-grad | Configurable |
| Rate limits | None | 1-10/day |
