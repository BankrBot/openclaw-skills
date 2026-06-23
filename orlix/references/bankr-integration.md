# Orlix + Bankr Integration Guide

Orlix provides the **intelligence layer** — multi-model AI chat, real-time token analysis, and B20 token deployment on Base — while Bankr provides **execution** — trades, agent wallets, and onchain actions.

Together they form a complete research-to-execution pipeline for Base.

---

## Architecture

```
User prompt
    ↓
Bankr Agent (receives intent)
    ↓
Orlix Skill (research + analysis + deployment)
    ├── Token analysis via /api/analyze
    ├── AI reasoning via /api/chat
    └── B20 deployment via /api/b20-skill
    ↓
Bankr Execution (trade, swap, sign tx, broadcast)
```

---

## Use Cases

### 1. Token Research Before Trading

Analyze a token with Orlix before Bankr executes the swap.

```bash
# Step 1: Get risk data from Orlix (advisory only)
bankr prompt "Use Orlix to analyze 0x799c28BAC95B3E0B26534D1e9A586511895EcBA3 on Base and show me the full risk report"

# Step 2: User reviews the report, then explicitly confirms before Bankr executes
bankr prompt "Buy $50 of 0x799c28BAC95B3E0B26534D1e9A586511895EcBA3 on Base"
```

> **Note:** The Orlix risk report is advisory only. Bankr must not automatically execute trades based on an Orlix verdict. The user must explicitly confirm every buy, sell, or deployment action.

---

### 2. AI-Assisted Market Analysis

Use Orlix's 19 models to reason about market conditions before making a move.

```bash
# Get Claude's take on a DeFi opportunity
bankr prompt "Ask Orlix (Claude): analyze liquidity conditions on Base and suggest the safest entry for $ORLIX"

# Cross-check with a different model
bankr prompt "Ask Orlix (GPT-4o): what's the risk of holding $ORLIX given current market structure?"
```

---

### 3. Automated Risk Screening

Screen any token for scam/rug risk before executing a trade.

```bash
bankr prompt "Use Orlix to check the liquidity ratio and buy/sell pressure for 0xABC...123 on Base"
```

> **Note:** Orlix verdict is informational. The user must decide whether to proceed — Bankr must not execute automatically based on the verdict.

---

### 4. B20 Token Deployment

Deploy a B20 token on Base via Bankr — no Solidity, no ABIs.

```bash
# Check gas before deploying
bankr prompt "Use Orlix B20 to get current gas prices on Base"

# Check wallet balance
bankr prompt "Use Orlix B20 to check ETH balance of 0xYOUR_WALLET"

# Validate config + live balance check
bankr prompt "Use Orlix B20 to validate: name='My Token', symbol='MTK', decimals=18, admin=0xYOUR_WALLET"

# Build full deployment tx (real gas + nonce from Base)
bankr prompt "Use Orlix B20 to prepare a B20 asset token: name='My Token', symbol='MTK', 1B supply cap, admin=0xYOUR_WALLET, blocklist policy"

# Check receipt after broadcasting
bankr prompt "Use Orlix B20 to check receipt of 0xTX_HASH on Base"
```

---

### 5. Read Any ERC-20 on Base

Use Orlix to fetch live token data from Base before making decisions.

```bash
# Get token info
bankr prompt "Use Orlix B20 to get token info for 0x799c28BAC95B3E0B26534D1e9A586511895EcBA3"

# Check a wallet's token balance
bankr prompt "Use Orlix B20 to get token info for 0xTOKEN with holder 0xWALLET"
```

---

### 6. Portfolio Monitoring + AI Commentary

Use Orlix AI to explain what's happening with your Base positions.

```bash
bankr prompt "Use Orlix to explain why $ORLIX moved +15% in the last 24h based on onchain data"
```

---

## Key Recommendation

> **Always run Orlix analysis before Bankr execution.**
>
> Orlix provides the risk context (liquidity ratio, buy/sell pressure, AI verdict). Bankr acts on that context. Never execute without first checking the Orlix verdict.

---

## Integration Points

| Orlix | Bankr |
|-------|-------|
| Token risk verdict | Trade execution |
| Live price + liquidity | Swap routing |
| AI model reasoning | Agent decision layer |
| Buy/sell pressure data | Stop-loss / take-profit |
| B20 deployment tx | Sign + broadcast |
| Gas + nonce from Base RPC | Transaction management |

---

## Links

- Orlix App: https://orlixai.xyz
- B20 Studio: https://orlixai.xyz/b20
- B20 API: https://orlixai.xyz/api/b20-skill?action=info
- Token Page: https://orlixai.xyz/token
- Telegram Bot: https://t.me/orlixai_bot
- Twitter: https://x.com/orlixai
