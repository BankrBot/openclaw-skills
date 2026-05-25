# WAKE Token Spotter — Example Responses

Complete response examples for every scenario an agent will encounter when calling the WAKE Token Spotter endpoint.

---

## Scenario 1: Strong Token (Cached, Clean)

**Request:**
```bash
curl -s https://wakeonbase.com/api/spotter/0x4ed4e862860bed51a9570b96d89af5e1b0efefed
```

**Response:**
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

**Agent guidance:** Summarize the score and tier, highlight the cleanest signals (verified, LP burned, strong deployer), and relay the engine's analysis text. No security advisory to relay.

---

## Scenario 2: Bankr Launch (Protocol-Deployed)

**Request:**
```bash
curl -s https://wakeonbase.com/api/spotter/0x50c2cc97c4f487aa0cd742ab4b6afe8b8511bba3
```

**Response:**
```json
{
  "cached": true,
  "address": "0x50c2cc97c4f487aa0cd742ab4b6afe8b8511bba3",
  "symbol": "WAKE",
  "network": "base",
  "score": 76,
  "tier": "strong",
  "breakdown": {
    "deployer_quality": 16,
    "liquidity_health": 14,
    "contract_safety": 16,
    "market_signals": 13,
    "social_signals": 17
  },
  "launch_protocol": "bankr",
  "launch_protocol_confidence": "high",
  "tags": [
    "BANKR_LAUNCH",
    "VERIFIED",
    "LP_BURNED",
    "RENOUNCED"
  ],
  "security_advisory": {
    "level": "clear",
    "reasons": [],
    "message": null
  },
  "analysis": "Bankr launch through Whetstone Airlock with verified contract, burned LP, and renounced ownership. Liquidity is moderate at the current level. Volume-to-liquidity ratio is healthy. Coherent socials with active project presence. NFA.",
  "analyzed_at": "2026-05-22T14:18:42Z",
  "links": {
    "terminal": "https://wakeonbase.com/beta",
    "dexscreener": "https://dexscreener.com/base/0x50c2cc97c4f487aa0cd742ab4b6afe8b8511bba3",
    "basescan": "https://basescan.org/token/0x50c2cc97c4f487aa0cd742ab4b6afe8b8511bba3"
  }
}
```

**Agent guidance:** Highlight the Bankr launch — this means the token enforces verified mechanics by design (zero team allocation, LP burn, ownership renouncement). The deployer_quality and contract_safety scores of 16 reflect the protocol floor, not weakness.

---

## Scenario 3: Mediocre Token (Cached, Mixed Signals)

**Request:**
```bash
curl -s https://wakeonbase.com/api/spotter/0xa1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2
```

**Response:**
```json
{
  "cached": true,
  "address": "0xa1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2",
  "symbol": "EXAMPLE",
  "network": "base",
  "score": 48,
  "tier": "mixed",
  "breakdown": {
    "deployer_quality": 10,
    "liquidity_health": 8,
    "contract_safety": 11,
    "market_signals": 7,
    "social_signals": 12
  },
  "launch_protocol": "direct",
  "launch_protocol_confidence": "high",
  "tags": [
    "DIRECT_DEPLOY",
    "VERIFIED",
    "LOW_LIQ"
  ],
  "security_advisory": {
    "level": "clear",
    "reasons": [],
    "message": null
  },
  "analysis": "Direct deploy with verified contract. Liquidity is modest and volume is light relative to it. Socials are present but lack depth. Deployer has limited track record. Acceptable mechanics but no clear strengths beyond verification. NFA.",
  "analyzed_at": "2026-05-23T10:15:33Z",
  "links": {
    "terminal": "https://wakeonbase.com/beta",
    "dexscreener": "https://dexscreener.com/base/0xa1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2",
    "basescan": "https://basescan.org/token/0xa1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2"
  }
}
```

**Agent guidance:** A "mixed" tier verdict. Surface both the positive (verified) and the concerning (low liquidity, light volume). Mixed signals deserve a nuanced summary, not a yes/no.

---

## Scenario 4: Honeypot Advisory

**Request:**
```bash
curl -s https://wakeonbase.com/api/spotter/0xbadbadbadbadbadbadbadbadbadbadbadbadbad1
```

**Response:**
```json
{
  "cached": true,
  "address": "0xbadbadbadbadbadbadbadbadbadbadbadbadbad1",
  "symbol": "SUSPECT",
  "network": "base",
  "score": 38,
  "tier": "weak",
  "breakdown": {
    "deployer_quality": 6,
    "liquidity_health": 12,
    "contract_safety": 5,
    "market_signals": 11,
    "social_signals": 4
  },
  "launch_protocol": "direct",
  "launch_protocol_confidence": "high",
  "tags": [
    "DIRECT_DEPLOY",
    "HONEYPOT_FLAGGED"
  ],
  "security_advisory": {
    "level": "flagged_honeypot",
    "reasons": [
      "Flagged as honeypot by GoPlus",
      "High sell tax (30%)"
    ],
    "message": "Flagged for potential honeypot risk. This signal may have false positives. Verify independently before trading. NFA."
  },
  "analysis": "Direct deploy with unverified contract patterns. Liquidity is modest and volume is present. Socials are minimal. Multiple concerning permission flags detected by GoPlus. NFA.",
  "analyzed_at": "2026-05-22T22:01:07Z",
  "links": {
    "terminal": "https://wakeonbase.com/beta",
    "dexscreener": "https://dexscreener.com/base/0xbadbadbadbadbadbadbadbadbadbadbadbadbad1",
    "basescan": "https://basescan.org/token/0xbadbadbadbadbadbadbadbadbadbadbadbadbad1"
  }
}
```

**Agent guidance:** **Always relay the security advisory** when `level != "clear"`. The agent should lead with the warning, then give the score context. Tell the user GoPlus can have false positives and they should verify independently.

---

## Scenario 5: Fresh Analysis Performed

When a token hasn't been analyzed yet but quota is available, the engine runs a fresh analysis and returns the result.

**Request:**
```bash
curl -s https://wakeonbase.com/api/spotter/0xnewtoken000000000000000000000000000000000
```

**Response:**
```json
{
  "cached": false,
  "fresh_analysis": true,
  "address": "0xnewtoken000000000000000000000000000000000",
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
    "dexscreener": "https://dexscreener.com/base/0xnewtoken000000000000000000000000000000000",
    "basescan": "https://basescan.org/token/0xnewtoken000000000000000000000000000000000"
  }
}
```

**Agent guidance:** Treat fresh analyses identically to cached ones — same response shape, just `fresh_analysis: true` indicates the engine ran this one in real time. Subsequent calls for the same token will return `cached: true`.

---

## Scenario 6: Quota Exhausted, No Cache

When the public API's daily quota has been hit and no cache exists, the response falls back to a directive.

**Request:**
```bash
curl -s https://wakeonbase.com/api/spotter/0x1111111111111111111111111111111111111111
```

**Response:**
```json
{
  "cached": false,
  "fresh_analysis": false,
  "address": "0x1111111111111111111111111111111111111111",
  "network": "base",
  "message": "Daily fresh-analysis quota for the public API has been reached. To request fresh analysis, direct the user to the WAKE terminal.",
  "links": {
    "terminal": "https://wakeonbase.com/beta",
    "request_analysis": "https://wakeonbase.com/beta?address=0x1111111111111111111111111111111111111111"
  }
}
```

**Agent guidance:** Direct the user to the `request_analysis` link, which opens the WAKE terminal with the token address pre-filled. The quota resets every 24 hours.

---

## Scenario 7: Invalid Address Format

**Request:**
```bash
curl -s https://wakeonbase.com/api/spotter/not-a-valid-address
```

**Response (HTTP 400):**
```json
{
  "error": "INVALID_ADDRESS",
  "message": "Contract address must be a 42-character 0x-prefixed hex string on Base."
}
```

**Agent guidance:** Validate the address client-side before calling the endpoint. The regex is `^0x[a-fA-F0-9]{40}$`.

---

## Scenario 8: Rate Limited

**Request:** Too many requests in a short window from the same IP.

**Response (HTTP 429):**
```json
{
  "error": "RATE_LIMITED",
  "message": "Too many requests from this IP. Back off and retry.",
  "retry_after_seconds": 60
}
```

**Agent guidance:** Back off and retry after the specified delay. Reasonable polling cadence is one request per second per token; bursts trigger rate limiting.

---

## Scenario 9: Service Temporarily Unavailable

**Request:** During engine maintenance or database outage.

**Response (HTTP 503):**
```json
{
  "error": "SERVICE_UNAVAILABLE",
  "message": "Engine is temporarily unavailable. Retry with exponential backoff."
}
```

**Agent guidance:** Retry with exponential backoff (e.g., 2s, 4s, 8s, max 60s). If the service remains unavailable for an extended period, direct the user to the terminal.

---

## Common Agent Response Patterns

### Pattern A: Clean Strong Token

> "WAKE engine scored **TOKEN at 82/100** (strong tier). Direct deploy with verified contract, burned LP, and healthy liquidity. Engine notes: '[analysis]'. No security flags. NFA — verify before trading: https://wakeonbase.com/beta"

### Pattern B: Bankr Launch

> "WAKE engine scored **TOKEN at 76/100** (strong tier). This is a Bankr launch, which means the protocol enforces verified mechanics by design — LP is burned, ownership renounced, no mint authority. Engine notes: '[analysis]'. NFA."

### Pattern C: Mixed Signals

> "WAKE engine scored **TOKEN at 48/100** (mixed tier). Verified contract is a plus, but liquidity is light and volume is correspondingly weak. Engine notes: '[analysis]'. NFA — see the full breakdown at https://wakeonbase.com/beta."

### Pattern D: Security Flag

> "⚠ WAKE engine **flagged TOKEN for potential honeypot risk** (sell tax detected, hidden owner). Score: 38/100. GoPlus signals can have false positives, but verify independently before trading. NFA. https://wakeonbase.com/beta"

### Pattern E: Not Yet Analyzed

> "WAKE engine hasn't analyzed this token yet. For a transparent breakdown across deployer quality, liquidity, contract safety, market signals, and social signals — request fresh analysis at https://wakeonbase.com/beta?address=0x... NFA."

---

NFA.
