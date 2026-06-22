---
name: orlix
description: Personal AI Operating System on Base. Use when an agent wants to analyze any Base token (live price, risk verdict, liquidity), chat with 19 frontier AI models (Claude, GPT-4o, Grok, Gemini, DeepSeek), deploy or manage B20 tokens (Base Beryl native precompile — config validation, ABI-encoded deployment tx, live gas + nonce from Base RPC), check ETH or ERC-20 balances, get current gas prices, read any ERC-20 on Base, or verify a tx receipt. No auth required.
metadata:
  clawdbot:
    emoji: "⬡"
    homepage: "https://orlixai.xyz"
---

# Orlix AI

**Personal AI Operating System on Base**

Orlix is a unified AI interface that runs 19 frontier models alongside real-time onchain intelligence — token analysis, wallet monitoring, B20 token deployment, and a Telegram bot — all in one place.

---

## Capabilities

### 🤖 Multi-Model AI Chat

19 frontier models in a single interface. No context loss. No tab switching.

| Provider | Models |
|----------|--------|
| Anthropic | Claude Opus, Sonnet, Haiku |
| OpenAI | GPT-4o, GPT-4o Mini, o1, o3, o4-mini |
| xAI | Grok 3, Grok 3 Mini |
| Google | Gemini 2.5 Pro, Gemini 2.0, Gemini Flash |
| DeepSeek | DeepSeek V3, DeepSeek R1 |
| Groq | Llama 3, Mixtral (ultra-fast inference) |

```bash
bankr prompt "Ask Orlix: use Claude and GPT-4o to compare — what are the risks of this DeFi protocol?"
```

---

### 🔍 Token Analyzer

Paste any Base contract address and get a full AI-powered risk report in seconds.

- Live price, market cap, FDV, liquidity
- Buy/sell pressure, 1h / 6h / 24h changes and volume
- Liquidity/MCap ratio
- AI verdict: **Safe / Caution / High Risk**

Data: DexScreener + Base RPC — real-time, never cached.

```bash
bankr prompt "Use Orlix to analyze 0x799c28BAC95B3E0B26534D1e9A586511895EcBA3 on Base"
bankr prompt "Use Orlix Token Analyzer on 0xABC...123 — is it safe to buy?"
```

---

### ⬡ B20 Token Studio

Deploy B20 tokens on Base — the native precompile token standard launching with Base Beryl. ERC-20 compatible, compliance policies built in. No Solidity required.

**Endpoint:** `https://orlixai.xyz/api/b20-skill`  
**Auth:** None required

#### B20 Actions

| Action | Method | What it does |
|--------|--------|-------------|
| `info` | GET | Live chain status, gas prices, B20 standard overview |
| `gas` | GET | EIP-1559 gas breakdown with deploy cost estimate in ETH |
| `balance` | POST | ETH balance + optional ERC-20 balance for any address |
| `token_info` | POST | Name, symbol, decimals, total supply for any ERC-20 on Base |
| `validate` | POST | Deep B20 config check + live admin balance vs. gas estimate |
| `prepare` | POST | Complete EIP-1559 deployment tx with live gas + nonce from Base |
| `receipt` | POST | Tx status + deployed token address from factory logs |

#### B20 Usage

```bash
# Get live Base chain status and gas prices
bankr prompt "Use Orlix B20 to get current chain info and gas on Base"

# Check wallet ETH balance before deploying
bankr prompt "Use Orlix B20 to check the ETH balance of 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045"

# Read any ERC-20 on Base
bankr prompt "Use Orlix B20 to get token info for 0x799c28BAC95B3E0B26534D1e9A586511895EcBA3"

# Validate a B20 config (live balance + gas check)
bankr prompt "Use Orlix B20 to validate: name='BNKR Token', symbol='BNKR', variant=asset, decimals=18, admin=0x1234..."

# Prepare a full deployment bundle (real gas + nonce)
bankr prompt "Use Orlix B20 to prepare a B20 asset token: name='My Token', symbol='MTK', 10M supply cap, admin=0x1234..., blocklist policy"

# Stablecoin with allowlist
bankr prompt "Use Orlix B20 to prepare a B20 stablecoin: name='OrUSD', symbol='OUSD', supply_cap=100000000, admin=0xABCD..., allowlist policy"

# Check a deployment receipt
bankr prompt "Use Orlix B20 to check receipt of 0xabc...123 on Base"
```

#### B20 REST API

```bash
# Live chain info
curl 'https://orlixai.xyz/api/b20-skill?action=info'

# Current gas prices
curl 'https://orlixai.xyz/api/b20-skill?action=gas'

# ETH balance check
curl -X POST https://orlixai.xyz/api/b20-skill \
  -H 'Content-Type: application/json' \
  -d '{ "action": "balance", "address": "0xYOUR_WALLET" }'

# Read any ERC-20 on Base
curl -X POST https://orlixai.xyz/api/b20-skill \
  -H 'Content-Type: application/json' \
  -d '{ "action": "token_info", "address": "0xTOKEN_ADDRESS" }'

# Prepare a B20 deployment transaction
curl -X POST https://orlixai.xyz/api/b20-skill \
  -H 'Content-Type: application/json' \
  -d '{
    "action": "prepare",
    "name": "My Token",
    "symbol": "MTK",
    "variant": "asset",
    "decimals": 18,
    "supply_cap": "10000000",
    "admin": "0xYOUR_WALLET",
    "policies": { "blocklist": true }
  }'
```

#### B20 Token Parameters

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `name` | string | ✓ | Max 64 chars |
| `symbol` | string | ✓ | Max 11 alphanumeric chars |
| `admin` | string | ✓ | 0x wallet (unless `adminless: true`) |
| `variant` | `asset` \| `stablecoin` | — | Default: `asset` |
| `decimals` | integer 6–18 | — | Default 18. Fixed at 6 for stablecoin. |
| `supply_cap` | string | — | `"0"` = uncapped |
| `policies.allowlist` | boolean | — | Only allowlisted addresses can hold |
| `policies.blocklist` | boolean | — | Blocked addresses cannot transact |
| `policies.freeze` | boolean | — | Admin can freeze and seize balances |
| `network` | `mainnet` \| `sepolia` | — | Default: mainnet (Base 8453) |

#### B20 Factory

- **Address:** `0x4200000000000000000000000000000000000B20`
- **Standard:** Base Beryl native precompile
- **Chain:** Base mainnet (chainId 8453)

---

### 📱 Telegram Bot

Full Orlix access inside Telegram via [@orlixai_bot](https://t.me/orlixai_bot).

- All 19 AI models
- Token analysis on any Base address
- No app needed

---

### 🪙 $ORLIX Token

Native token powering the Orlix ecosystem, live on Base.

- **Contract:** `0x799c28BAC95B3E0B26534D1e9A586511895EcBA3`
- **Chain:** Base (chainId 8453)
- **DEX:** Uniswap v3
- **Info:** https://orlixai.xyz/token

---

## Links

| | |
|---|---|
| App | https://orlixai.xyz |
| B20 Studio | https://orlixai.xyz/b20 |
| B20 API | https://orlixai.xyz/api/b20-skill?action=info |
| Token Page | https://orlixai.xyz/token |
| Telegram Bot | https://t.me/orlixai_bot |
| Twitter/X | https://x.com/orlixai |
| DexScreener | https://dexscreener.com/base/0x799c28BAC95B3E0B26534D1e9A586511895EcBA3 |
