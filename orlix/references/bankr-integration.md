# Orlix + Bankr Integration Guide

Orlix provides the **intelligence layer** — multi-model AI chat and real-time token analysis on Base — while Bankr provides **execution** — trades, agent wallets, and onchain actions.

Together they form a complete research-to-execution pipeline for Base.

---

## Architecture

```
User prompt
    ↓
Bankr Agent (receives intent)
    ↓
Orlix Skill (research + analysis)
    ├── Token analysis via /api/analyze
    └── AI reasoning via /api/chat
    ↓
Bankr Execution (trade, swap, order)
```

---

## Use Cases

### 1. Token Research Before Trading

Analyze a token with Orlix before Bankr executes the swap.

```bash
# Step 1: Analyze with Orlix
bankr prompt "Use Orlix to analyze 0x799c28BAC95B3E0B26534D1e9A586511895EcBA3 on Base — is it safe to buy?"

# Step 2: If verdict is SAFE, execute with Bankr
bankr prompt "Buy $50 of 0x799c28BAC95B3E0B26534D1e9A586511895EcBA3 on Base"
```

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
# Screen before buying
bankr prompt "Use Orlix to check if 0xABC...123 on Base is a rug — only proceed if verdict is SAFE"
```

---

### 4. Portfolio Monitoring + AI Commentary

Use Orlix AI to explain what's happening with your Base positions.

```bash
# Get AI commentary on a token movement
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

---

## Links

- Orlix App: https://orlixai.xyz
- Token Page: https://orlixai.xyz/token
- Telegram Bot: https://t.me/orlixai_bot
- Twitter: https://x.com/orlixai
