---
name: dumbmoney
description: "Trade reflection tokens on DumbMoney — Solana's token launchpad where holders earn passive SOL income from every sell. Browse tokens, check earnings, find high-yield reflection tokens."
metadata: {"clawdbot": {"emoji": "💸", "homepage": "https://dumbmoney.win", "requires": {"bins": ["curl", "jq"]}}}
---

# DumbMoney — Solana Reflection Token Launchpad

DumbMoney is a token launchpad on Solana where every token has **built-in reflection mechanics**. When someone sells a token, a percentage of the sale is automatically distributed to all holders as SOL. The more you hold, the more you earn — passively.

## How It Works

1. **Bonding Curve**: Each token launches on a bonding curve. Early buyers get lower prices. The curve graduates to Raydium at ~$69k market cap.
2. **Reflection Fee**: Every sell triggers a reflection fee (typically 1-10%) that gets distributed proportionally to all holders.
3. **Burn Fee**: A portion of each sell is also burned, reducing supply over time.
4. **Passive Income**: Holders earn SOL just by holding. No staking, no claiming needed — reflections accumulate automatically.

## Key Concepts

- **Reflection Rate**: The percentage of each sell distributed to holders (e.g., 5% = 500 bps)
- **Reflection Pool**: Total SOL that has been distributed to holders for a token
- **Your Share**: Your percentage of the total holder pool — determines how much of each reflection you receive
- **Bonding Curve Progress**: How close a token is to graduating to Raydium (100% = graduated)

## What You Can Do

### Browse All Tokens
To see what tokens are available on DumbMoney, run:
```bash
{baseDir}/scripts/list-tokens.sh
```
This returns all tokens with their reflection rates, reserves, and earnings data.

### Get Token Details
To get detailed info about a specific token (by its mint address):
```bash
{baseDir}/scripts/token-info.sh <MINT_ADDRESS>
```
Returns price, market cap, reflection pool, bonding curve progress, and more.

### Find Top Earning Tokens
To see which tokens have paid out the most in reflections:
```bash
{baseDir}/scripts/top-earners.sh
```
Returns the top 10 tokens ranked by total reflections paid to holders.

### Check Your Earnings
To see how much a specific wallet has earned from a token:
```bash
{baseDir}/scripts/check-earnings.sh <MINT_ADDRESS> <WALLET_ADDRESS>
```
Returns pending SOL earnings, your share percentage, and USD value.

### Buy a DumbMoney Token
To buy a DumbMoney token, use Bankr's built-in Solana swap:
> "Swap [AMOUNT] SOL for [MINT_ADDRESS] on Solana"

The mint address can be found using the list-tokens or token-info scripts.

### Sell a DumbMoney Token
To sell, use Bankr's built-in swap:
> "Swap [AMOUNT] [MINT_ADDRESS] for SOL on Solana"

Note: Selling triggers the reflection fee, which pays other holders.

### Launch Your Own Token (for AI Agents)
AI agents can register on DumbMoney and launch their own reflection tokens via API. No approval needed — self-service registration.

**Step 1: Register to get an API key**
```bash
curl -X POST https://dumbmoney.win/api/agents/register \
  -H 'Content-Type: application/json' \
  -d '{"name": "my-agent", "description": "My trading bot", "fee_wallet": "OPTIONAL_SOLANA_ADDRESS"}'
```
Save the returned `api_key` — it's shown only once.

**Step 2: Create a token**
```bash
curl -X POST https://dumbmoney.win/api/tokens/create \
  -H 'Content-Type: application/json' \
  -H 'X-API-Key: YOUR_API_KEY' \
  -d '{"name": "MyToken", "symbol": "MTK", "description": "A reflection token", "reflection_bps": 500, "burn_bps": 100}'
```
The platform handles gas fees, image upload, metadata, and on-chain creation. Your agent earns creator fees on every trade.

- Agent docs: https://dumbmoney.win/llms.txt
- OpenAPI spec: https://dumbmoney.win/openapi.json

## Trading Strategies

- **High Reflection Rate**: Look for tokens with 5%+ reflection rates — more of each sell goes to holders
- **Growing Reflection Pool**: Tokens with large and growing reflection pools indicate active trading and real earnings
- **Early Bonding Curve**: Tokens earlier on the bonding curve have more upside potential before graduation
- **Low Market Cap + High Reflection**: Best risk/reward for passive income plays

## Example Prompts

- "Show me all DumbMoney tokens"
- "What are the top earning reflection tokens on DumbMoney?"
- "Get details on DumbMoney token [mint address]"
- "How much has wallet [address] earned from token [mint]?"
- "Buy 0.5 SOL of the top earning DumbMoney token"
- "Find DumbMoney tokens with reflection rates above 5%"

## Links

- Website: https://dumbmoney.win
- Launch a token: https://dumbmoney.win/launch
- API docs: See `references/api-docs.md`
