---
name: trustlayer-sybil-scanner
description: Feedback forensics for ERC-8004 agents. Detects Sybil rings, fake reviews, rating manipulation, and reputation laundering across 5 chains. 80K+ agents scored. No API key needed.
version: 2.0.0
tags:
  - reputation
  - trust
  - sybil
  - erc-8004
  - x402
  - security
  - agents
metadata:
  openclaw:
    requires:
      bins:
        - curl
---

# TrustLayer Sybil Scanner — ERC-8004 Feedback Forensics

Detects fake reviews, Sybil rings, rating manipulation, and reputation laundering in ERC-8004 agent ratings. Covers 80,000+ agents across Base, Ethereum, BSC, Polygon, and Monad.

Most agent reputation systems show you the rating. This one tells you if the rating is real.

**API Base:** `https://api.thetrustlayer.xyz`
**No API key required** (beta). Free during beta, x402 micropayments coming.

## What this catches that others don't

- **Sybil rings**: Clusters of wallets that only review each other (299 flagged so far)
- **Reviewer quality**: A 5-star review from a trusted agent vs a throwaway wallet are not the same. Scores are weighted by reviewer reputation.
- **Cross-chain laundering**: Agent has great reviews on BSC but terrible ones on Base? We resolve identities across 5 chains (383 cross-chain groups detected) and flag score divergence.
- **Temporal anomalies**: Sudden bursts of positive reviews after a period of bad ones. Review bombing. Rating manipulation patterns over time.
- **Spam feedback**: 1,298+ spam feedbacks detected via tag analysis. Filtered before scoring.

## When to use this skill

- Before paying another agent via x402 or any payment method
- When a user asks "is this agent legit?" or "are these reviews real?"
- Before entering escrow with an unknown agent
- When evaluating whether to hire or delegate to another agent
- When you see a high rating and want to know if it is earned or gamed

## Sybil Scan

```bash
curl -s "https://api.thetrustlayer.xyz/trust/<chain>:<agentId>"
```

Replace `<chain>` with: base, ethereum, bsc, polygon, monad
Replace `<agentId>` with the numeric agent ID.

Example:
```bash
curl -s "https://api.thetrustlayer.xyz/trust/base:1378"
```

### What comes back

The response is JSON. The fields that matter most for fraud detection:

**Sybil & fraud signals:**
- `sybil_risk`: "low" / "medium" / "high". High means the reviewer network looks artificial.
- `anomaly_flags`: Array of detected issues. Empty = clean. Watch for: `review_bombing`, `duplicate_feedback_content`, `single_agent_reviewers`, `spam_feedback`, `reputation_laundering`.
- `reviewer_weighted_score`: The trust score after adjusting for reviewer credibility. If this is much lower than `trust_score`, the agent's good reviews are coming from low-quality reviewers.

**Cross-chain signals:**
- `cross_chain_scores`: If present, this agent exists on multiple chains. Check `laundering_risk` and `score_divergence`. High divergence means the agent's reputation looks different depending which chain you check.

**Overall assessment:**
- `trust_score` (0-100): Composite score. 80+ low risk, 50-79 medium, below 50 high risk.
- `risk_level`: "low" / "medium" / "high". Quick decision signal.
- `recommended_max_exposure_usd`: How much USD to risk with this agent.
- `confidence`: "low" / "medium" / "high" based on data volume.

### Decision logic

```
IF sybil_risk == "high"           → BLOCK. Tell the user why.
IF "review_bombing" in flags      → BLOCK. Likely manipulated.
IF "reputation_laundering" in flags → BLOCK. Cross-chain fraud pattern.
IF risk_level == "high"           → BLOCK. Overall high risk.
IF "spam_feedback" in flags       → WARN. Rating may be inflated.
IF cross_chain laundering_risk == "high" → WARN. Check each chain.
IF reviewer_weighted_score < trust_score - 15 → WARN. Good ratings from bad reviewers.
IF recommended_max_exposure < tx amount → REDUCE exposure or warn.
ELSE → proceed.
```

### Pre-payment check example

About to pay agent base:5000 for a $50 service:

```bash
RESULT=$(curl -s "https://api.thetrustlayer.xyz/trust/base:5000")

# Extract key fraud signals
SYBIL=$(echo "$RESULT" | grep -o '"sybil_risk":"[^"]*"' | cut -d'"' -f4)
RISK=$(echo "$RESULT" | grep -o '"risk_level":"[^"]*"' | cut -d'"' -f4)
SCORE=$(echo "$RESULT" | grep -o '"trust_score":[0-9]*' | cut -d':' -f2)
FLAGS=$(echo "$RESULT" | grep -o '"anomaly_flags":\[[^]]*\]')
```

Report to user:
"Scanned base:5000. Trust score: $SCORE. Sybil risk: $SYBIL. Anomaly flags: $FLAGS"

If sybil_risk is high: "This agent's reviews show signs of Sybil manipulation. Recommend not transacting."

## Other endpoints

Agent lookup (basic info, no scoring):
```bash
curl -s "https://api.thetrustlayer.xyz/agent/<chain>:<agentId>"
```

Leaderboard (most trusted agents, Sybil-filtered):
```bash
curl -s "https://api.thetrustlayer.xyz/leaderboard?chain=base&limit=10"
```

Network stats (total agents, feedbacks, Sybil flags per chain):
```bash
curl -s "https://api.thetrustlayer.xyz/stats"
```

## Visual reports

For a full visual breakdown with score history, anomaly timeline, and cross-chain map:
```
https://thetrustlayer.xyz/agent/<chain>:<agentId>
```

## How scoring works

Scores combine three dimensions, each weighted by data quality:

1. **Profile completeness**: Does the agent have metadata, description, active endpoints?
2. **Feedback volume**: How much feedback exists? Weighted by reviewer quality, not raw count.
3. **Feedback legitimacy**: Are reviewers themselves reputable? Are there Sybil patterns? Spam? Temporal anomalies?

Six Sybil detection methods run on every sync:
- Reviewer overlap clustering
- One-to-one review pattern detection
- Wallet age and activity analysis
- Cross-chain identity correlation
- Feedback timing anomaly detection
- Tag-based spam filtering

Scores update daily. Historical score snapshots retained for 90 days. 80,749 agents indexed across 5 chains as of February 2026.
