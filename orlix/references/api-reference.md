# Orlix API Reference

Base URL: `https://orlixai.xyz`

---

## Authentication

No API key required for public endpoints. All requests are made directly via HTTP.

---

## Endpoints

### POST /api/analyze

Analyze any token on Base with AI-powered risk verdict.

**Request:**
```json
{
  "address": "0x799c28BAC95B3E0B26534D1e9A586511895EcBA3",
  "chain": "base"
}
```

**Response:**
```json
{
  "verdict": "SAFE",
  "price": "$0.00042",
  "marketCap": "$420,000",
  "liquidity": "$168,000",
  "fdv": "$420,000",
  "priceChange": {
    "h1": "+2.4%",
    "h6": "+8.1%",
    "h24": "+15.3%"
  },
  "volume": {
    "h1": "$12,400",
    "h6": "$54,200",
    "h24": "$210,800"
  },
  "liquidityRatio": "40%",
  "buySellRatio": "0.68",
  "aiAnalysis": "This token shows healthy liquidity relative to market cap..."
}
```

**Verdict values:** `SAFE` · `CAUTION` · `HIGH RISK`

---

### POST /api/chat

Send a message to any of 19 supported AI models.

**Request:**
```json
{
  "model": "claude-sonnet-4-6",
  "messages": [
    { "role": "user", "content": "What is the best DeFi strategy on Base?" }
  ],
  "stream": false
}
```

**Supported model prefixes:**
| Prefix | Provider |
|--------|----------|
| `claude-*` | Anthropic |
| `gpt-*`, `o1`, `o3`, `o4-*` | OpenAI |
| `grok-*` | xAI |
| `gemini-*` | Google |
| `deepseek-*` | DeepSeek |
| `groq-*` | Groq |
| `mimo-*` | Mimo |

**Response:**
```json
{
  "content": "The best DeFi strategies on Base include...",
  "model": "claude-sonnet-4-6",
  "usage": {
    "input_tokens": 18,
    "output_tokens": 245
  }
}
```

**Streaming:** Set `"stream": true` to receive SSE (Server-Sent Events) response.

---

### GET /api/ping

Health check endpoint.

**Response:**
```json
{ "ok": true }
```

---

## Data Sources

| Source | Usage |
|--------|-------|
| DexScreener API | Live price, volume, liquidity, buy/sell data |
| Base RPC (`mainnet.base.org`) | On-chain supply, decimals |
| Anthropic Claude | AI analysis and verdict generation |

---

## Token Contract

$ORLIX on Base: `0x799c28BAC95B3E0B26534D1e9A586511895EcBA3`

- Explorer: https://basescan.org/token/0x799c28BAC95B3E0B26534D1e9A586511895EcBA3
- DexScreener: https://dexscreener.com/base/0x799c28BAC95B3E0B26534D1e9A586511895EcBA3
