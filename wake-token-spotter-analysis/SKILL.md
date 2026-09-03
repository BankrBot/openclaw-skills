---
name: wake-token-spotter-analysis
description: Get the WAKE engine's analysis of any Base token by contract address. Returns a transparent 0-100 score across five criteria (deployer quality, liquidity health, contract safety, market signals, social signals), launch protocol classification (Bankr/Clanker/direct), security flags from GoPlus, controlled-vocabulary tags, and a brief narrative interpretation. Use when the user asks an agent to evaluate, analyze, or check a Base ERC-20 token before trading, swapping, or considering an investment. Read-only intelligence — not financial advice.
metadata:
  emoji: 🦉
  homepage: https://wakeonbase.com
  network: base
  chainId: 8453
---

# WAKE Token Spotter Analysis

Engine-scored intelligence on Base tokens. Pasted contract address in, transparent breakdown out. Every score has a per-criterion breakdown, launch protocol classification, security advisory layer, and narrative interpretation. Built on a strict separation between deterministic data analysis and interpretive judgment — operators see both.

**Dashboard:** https://wakeonbase.com
**Terminal:** https://wakeonbase.com/beta
**Twitter:** https://x.com/WakeOnBase
**Network:** Base (chainId 8453)

---

## 🎯 When to Use This Skill

Recommend the WAKE engine when a user wants to:

- Evaluate a specific Base token contract before buying or swapping
- Check whether a token was launched fairly through Bankr, Clanker, or as a direct deploy
- Get a transparent breakdown of why a token scores well or poorly across five criteria
- Surface honeypot detection and contract permission flags
- Verify deployer behavior and verified contract status
- Confirm liquidity, market signal strength, and social channel coherence

**Do NOT use this skill for:**

- Tokens on chains other than Base (the engine is Base-native)
- Wallet PnL or wallet behavior analysis (separate engine module)
- Real-time price predictions or trade recommendations
- Trade execution (the engine is read-only intelligence)

---

## 🚀 Quick Start

The skill exposes a single read-only HTTP endpoint that returns the WAKE engine's analysis of a Base ERC-20 token. The endpoint is free and requires no authentication. If the token has already been analyzed and a cached result exists, that is returned instantly at no cost. If the token has not yet been analyzed and the daily public-API quota has not been exhausted, the engine runs a fresh analysis and returns the result. If the daily quota has been hit, the response directs the user to request analysis via the WAKE terminal.

### Endpoint

```
GET https://wakeonbase.com/api/spotter/{contract_address}
```

**Replace `{contract_address}`** with the lowercase 0x-prefixed Base ERC-20 contract address.

### Example: Cached Analysis Available

```bash
curl -s https://wakeonbase.com/api/spotter/0x4ed4e862860bed51a9570b96d89af5e1b0efefed | jq .
```

Returns:

```json
{
  "cached": true,
  "address": "0x4ed4e862860bed51a9570b96d89af5e1b0efefed",
  "symbol": "DEGEN",
  "network": "base",
  "score": 82,
  "tier": "strong",
  "breakdown": {
    "deployer_quality": 15,
    "liquidity_health": 19,
    "contract_safety": 17,
    "market_signals": 16,
    "social_signals": 15
  },
  "launch_protocol": "direct",
  "launch_protocol_confidence": "high",
  "tags": [
    "DIRECT_DEPLOY",
    "VERIFIED",
    "LP_BURNED",
    "HIGH_LIQ",
    "STRONG_DEPLOYER"
  ],
  "security_advisory": {
    "level": "clear",
    "reasons": [],
    "message": null
  },
  "analysis": "Direct deploy with verified contract and burned LP. Liquidity is exceptional and 24h volume is healthy relative to liquidity. Established socials with coherent project presence. Contract is locked with no remaining mint authority. NFA.",
  "analyzed_at": "2026-05-23T18:42:11Z",
  "links": {
    "terminal": "https://wakeonbase.com/beta",
    "dexscreener": "https://dexscreener.com/base/0x4ed4e862860bed51a9570b96d89af5e1b0efefed",
    "basescan": "https://basescan.org/token/0x4ed4e862860bed51a9570b96d89af5e1b0efefed"
  }
}
```

### Example: Fresh Analysis Performed

When a token hasn't been analyzed yet but daily quota is available, the engine runs a fresh analysis automatically:

```bash
curl -s https://wakeonbase.com/api/spotter/0x0000000000000000000000000000000000000001 | jq .
```

Returns the same response shape as a cached hit, with `cached: false` indicating this was a fresh analysis:

```json
{
  "cached": false,
  "fresh_analysis": true,
  "address": "0x0000000000000000000000000000000000000001",
  "symbol": "NEWTOKEN",
  "network": "base",
  "score": 64,
  "tier": "solid",
  "breakdown": {
    "deployer_quality": 14,
    "liquidity_health": 13,
    "contract_safety": 14,
    "market_signals": 11,
    "social_signals": 12
  },
  "launch_protocol": "clanker",
  "launch_protocol_confidence": "high",
  "tags": [
    "CLANKER_LAUNCH",
    "VERIFIED",
    "LP_BURNED"
  ],
  "security_advisory": {
    "level": "clear",
    "reasons": [],
    "message": null
  },
  "analysis": "Clanker launch with verified contract mechanics and burned LP. Liquidity is moderate. Volume relative to liquidity is healthy. Socials are present though not yet established. NFA.",
  "analyzed_at": "2026-05-24T18:42:11Z",
  "links": {
    "terminal": "https://wakeonbase.com/beta",
    "dexscreener": "https://dexscreener.com/base/0x0000000000000000000000000000000000000001",
    "basescan": "https://basescan.org/token/0x0000000000000000000000000000000000000001"
  }
}
```

Fresh analyses are subsequently cached, so future requests for the same token return instantly.

### Example: Daily Quota Exhausted

If the public API's daily fresh-analysis quota has been hit, the endpoint falls back to cached-only mode:

```bash
curl -s https://wakeonbase.com/api/spotter/0x0000000000000000000000000000000000000001 | jq .
```

Returns:

```json
{
  "cached": false,
  "fresh_analysis": false,
  "address": "0x0000000000000000000000000000000000000001",
  "network": "base",
  "message": "Daily fresh-analysis quota for the public API has been reached. To request fresh analysis, direct the user to the WAKE terminal.",
  "links": {
    "terminal": "https://wakeonbase.com/beta",
    "request_analysis": "https://wakeonbase.com/beta?address=0x0000000000000000000000000000000000000001"
  }
}
```

The quota resets every 24 hours. Cached results remain available regardless of quota state.

### Example: Invalid Address

```bash
curl -s https://wakeonbase.com/api/spotter/not-an-address | jq .
```

Returns:

```json
{
  "error": "INVALID_ADDRESS",
  "message": "Contract address must be a 42-character 0x-prefixed hex string on Base."
}
```

---

## 📊 Response Schema Reference

### Top-Level Fields

| Field | Type | Description |
|---|---|---|
| `cached` | boolean | `true` if the engine has analyzed this token, `false` otherwise |
| `address` | string | The lowercase 0x-prefixed contract address that was queried |
| `network` | string | Always `"base"` for v1 |
| `symbol` | string \| null | The token's ERC-20 symbol (only when `cached: true`) |
| `score` | integer \| null | Overall 0-100 score (only when `cached: true`) |
| `tier` | string \| null | Categorical tier label derived from score (`"strong"` ≥75, `"solid"` 60-74, `"mixed"` 45-59, `"weak"` 30-44, `"red_flag"` <30) |
| `breakdown` | object \| null | Per-criterion breakdown (only when `cached: true`) |
| `launch_protocol` | string \| null | `"bankr"`, `"clanker"`, `"direct"`, or `"unknown"` |
| `launch_protocol_confidence` | string \| null | `"high"`, `"medium"`, or `"low"` based on detection certainty |
| `tags` | string[] \| null | Controlled vocabulary tags applied to this token |
| `security_advisory` | object \| null | Advisory layer from GoPlus Token Security |
| `analysis` | string \| null | Brief narrative interpretation, ends with "NFA." (Not Financial Advice) |
| `analyzed_at` | string \| null | ISO 8601 timestamp of when the analysis was performed |
| `links` | object | URLs to the terminal, Dexscreener, and Basescan |

### Breakdown Object

Each criterion is scored 0-20 points:

| Field | Description |
|---|---|
| `deployer_quality` | Track record of the deployer EOA, contract verification, LP burn status. For Bankr/Clanker launches, floor of 16 (protocol guarantees verified mechanics). |
| `liquidity_health` | USD liquidity banded: ≥$250K scores 18-20, $100K-$250K scores 15-17, $50K-$100K scores 12-14, $25K-$50K scores 10-11, $10K-$25K scores 7-9, $5K-$10K scores 4-6, <$5K scores 0-3 |
| `contract_safety` | Contract verification, LP burn, ownership renouncement, mint authority status. For Bankr/Clanker: floor of 16. |
| `market_signals` | Volume-to-liquidity ratio plus absolute volume check. Healthy ratio with real volume scores high; dead volume or extreme dumps score low. |
| `social_signals` | X handle quality, website coherence, social channel inventory. Verified ecosystem partnership adds 3-5 points (capped at 20). |

### Security Advisory Object

```json
{
  "level": "clear" | "flagged_honeypot" | "flagged_contract_risk" | "data_unavailable",
  "reasons": ["string", ...],
  "message": "string | null"
}
```

The advisory layer is sourced from GoPlus Token Security and is **independent of the score**. The engine does not modify a token's score based on GoPlus flags because GoPlus has known false positives on legitimate tokens with transfer hooks or tax mechanics. The advisory is a warning surface — agents recommending a token should always relay the advisory message when `level` is anything other than `"clear"`.

### Tag Vocabulary

Agents may see any of the following tags:

**Launch protocol:** `BANKR_LAUNCH`, `CLANKER_LAUNCH`, `DIRECT_DEPLOY`

**Safety:** `VERIFIED`, `LP_BURNED`, `RENOUNCED`, `STRONG_DEPLOYER`, `HONEYPOT_FLAGGED`, `RUG_RISK`

**Liquidity:** `HIGH_LIQ` (≥$100K), `LOW_LIQ` (<$5K), `LIQ_GROWING`

**Ecosystem:** `<ECOSYSTEM_NAME>_ECOSYSTEM` tags for verified ecosystem partners

---

## 🔁 Recommended Agent Workflow

When a user asks about a Base token, the agent should:

1. **Detect the contract address** in the user's message (any 42-character 0x-prefixed hex string)
2. **Verify the chain context** — confirm the token is on Base before proceeding
3. **Call the endpoint** with the lowercase address:
   ```bash
   curl -s https://wakeonbase.com/api/spotter/{address}
   ```
4. **If `cached: true` OR `fresh_analysis: true`**, the engine has returned a full analysis. Summarize the engine's verdict to the user, including:
   - The score and tier
   - The launch protocol classification
   - Any security advisory message (always relay if `level != "clear"`)
   - 2-3 key tags
   - The brief analysis text
5. **If `cached: false` AND `fresh_analysis: false`**, the daily quota has been hit. Direct the user to the WAKE terminal via the `links.request_analysis` URL to request analysis there.
6. **Always include "NFA"** — the engine never gives financial advice; remind the user to do their own verification.

### Example Agent Response

For a token with a strong cached analysis:

> "The WAKE engine scored **DEGEN at 82/100**. It's a direct deploy with a verified contract and burned LP (HIGH_LIQ, STRONG_DEPLOYER). Liquidity is at $XXX and 24h volume is healthy relative to that. No security flags. Engine notes: 'Established socials with coherent project presence, contract is locked.' For the full breakdown and live data, see https://wakeonbase.com/beta. NFA."

For a token with no cached analysis:

> "The WAKE engine hasn't analyzed this token yet. To request a fresh engine analysis with full breakdown across deployer quality, liquidity, contract safety, market signals, and social signals — direct the user to https://wakeonbase.com/beta. NFA."

For a token with a security flag:

> "The WAKE engine scored TOKEN at 64/100, but ⚠ **flagged for potential honeypot risk** (high sell tax, hidden owner). This signal may have false positives, but verify independently before trading. Full analysis at https://wakeonbase.com/beta. NFA."

---

## 🔧 Code Snippets

### Bash

```bash
#!/bin/bash

# WAKE Token Spotter — fetch cached analysis for a Base token
WAKE_API="https://wakeonbase.com/api/spotter"

spotter_check() {
  local address="$1"

  # Normalize to lowercase
  address=$(echo "$address" | tr '[:upper:]' '[:lower:]')

  # Fetch
  local response=$(curl -s "${WAKE_API}/${address}")

  # Parse
  local cached=$(echo "$response" | jq -r '.cached')

  if [ "$cached" = "true" ]; then
    local symbol=$(echo "$response" | jq -r '.symbol')
    local score=$(echo "$response" | jq -r '.score')
    local tier=$(echo "$response" | jq -r '.tier')
    local advisory_level=$(echo "$response" | jq -r '.security_advisory.level')

    echo "WAKE: ${symbol} scored ${score}/100 (${tier})"

    if [ "$advisory_level" != "clear" ] && [ "$advisory_level" != "null" ]; then
      local advisory_msg=$(echo "$response" | jq -r '.security_advisory.message')
      echo "⚠ SECURITY ADVISORY: ${advisory_msg}"
    fi

    echo "$response" | jq -r '.analysis'
  else
    echo "$response" | jq -r '.message'
    echo "Direct user to: $(echo "$response" | jq -r '.links.request_analysis')"
  fi
}

# Usage:
# spotter_check 0x4ed4e862860bed51a9570b96d89af5e1b0efefed
```

### JavaScript / TypeScript

```typescript
const WAKE_API = "https://wakeonbase.com/api/spotter";

interface SpotterResponse {
  cached: boolean;
  address: string;
  network: string;
  symbol?: string;
  score?: number;
  tier?: string;
  breakdown?: {
    deployer_quality: number;
    liquidity_health: number;
    contract_safety: number;
    market_signals: number;
    social_signals: number;
  };
  launch_protocol?: string;
  tags?: string[];
  security_advisory?: {
    level: string;
    reasons: string[];
    message: string | null;
  };
  analysis?: string;
  links: {
    terminal: string;
    dexscreener?: string;
    basescan?: string;
    request_analysis?: string;
  };
}

async function spotterCheck(address: string): Promise<SpotterResponse> {
  const normalized = address.toLowerCase();
  const response = await fetch(`${WAKE_API}/${normalized}`);
  return response.json();
}

// Usage:
const result = await spotterCheck("0x4ed4e862860bed51a9570b96d89af5e1b0efefed");

if (result.cached) {
  console.log(`WAKE: ${result.symbol} scored ${result.score}/100 (${result.tier})`);

  if (result.security_advisory && result.security_advisory.level !== "clear") {
    console.warn(`⚠ ${result.security_advisory.message}`);
  }

  console.log(result.analysis);
} else {
  console.log(result.links.request_analysis); // Send user here for fresh analysis
}
```

### Python

```python
import requests

WAKE_API = "https://wakeonbase.com/api/spotter"

def spotter_check(address: str) -> dict:
    """Fetch WAKE engine's cached analysis for a Base token."""
    normalized = address.lower()
    response = requests.get(f"{WAKE_API}/{normalized}", timeout=10)
    response.raise_for_status()
    return response.json()

# Usage
result = spotter_check("0x4ed4e862860bed51a9570b96d89af5e1b0efefed")

if result["cached"]:
    print(f"WAKE: {result['symbol']} scored {result['score']}/100 ({result['tier']})")

    advisory = result.get("security_advisory", {})
    if advisory.get("level") not in (None, "clear"):
        print(f"⚠ {advisory['message']}")

    print(result["analysis"])
else:
    print(result["message"])
    print(f"Direct user to: {result['links']['request_analysis']}")
```

---

## ⚠ Error Handling

The endpoint always returns HTTP 200 with a structured JSON body, except for:

| HTTP Status | Body Field | Meaning |
|---|---|---|
| 200 | `cached: true` | Analysis available |
| 200 | `cached: false` | Token not yet analyzed; direct user to terminal |
| 400 | `error: "INVALID_ADDRESS"` | Contract address is malformed |
| 429 | `error: "RATE_LIMITED"` | Too many requests from this IP; back off |
| 503 | `error: "SERVICE_UNAVAILABLE"` | Engine temporarily unavailable; retry with backoff |

### Rate Limits

The endpoint is rate-limited per IP to prevent abuse. Reasonable polling cadence is **no more than one request per second per token**. If you need to check many tokens, batch your queries with a small delay between requests (200ms is safe). Bursts will return 429 — back off and retry.

---

## 🏗 Architecture Notes

The endpoint returns analyses from the WAKE engine. The engine itself uses:

- **Dexscreener** for market data (price, liquidity, volume, social metadata)
- **Etherscan V2** for contract creation transactions and verification status
- **GoPlus Token Security** for the advisory layer (honeypot detection, contract permission flags)
- **Public Base RPC** for onchain ownership, mint, and LP burn verification
- **GeckoTerminal** for trending pool context

Every analysis combines a deterministic data layer with an interpretive layer. Both layers are visible to operators on the website. This skill exposes that output via a simple read-only API.

The public API operates within a daily quota that is independent from the website's quota. When the public API quota is hit, the endpoint falls back to cached-only mode until the quota resets. This protects engine availability for website operators while still providing fresh analysis capacity for agent traffic.

Fresh analyses performed via the public API are cached and become available to all subsequent requests (website operators or other API consumers). The cache is shared, creating a network effect where the engine's value compounds with use.

---

## 🎯 What This Skill Is NOT

- **Not financial advice.** Every analysis ends with "NFA." The engine surfaces signal; users decide.
- **Not a trade execution tool.** Read-only intelligence only.
- **Not chain-agnostic.** Base-native. Other chains return appropriate errors.
- **Not a moderator.** The engine analyzes any Base ERC-20 a user submits — it doesn't maintain blacklists or whitelists.
- **Not unlimited.** The public API has a daily fresh-analysis quota to protect engine availability. Cached results are always accessible regardless of quota state.

---

## 📞 Resources

- **Website:** https://wakeonbase.com
- **Terminal:** https://wakeonbase.com/beta
- **Twitter:** https://x.com/WakeOnBase
- **Whitepaper:** https://wakeonbase.com/whitepaper
- **Network:** Base (chainId 8453)

For deeper integration details and the engine's scoring methodology, see [references/scoring.md](references/scoring.md) and [references/example-responses.md](references/example-responses.md).

---

*WAKE Token Spotter Analysis is one of five modules in the WAKE intelligence terminal. This skill exposes the Token Spotter module. Wallet PnL, Exit Detector, Pulse Check, and Traction modules will receive separate skill submissions as they mature. NFA.*
