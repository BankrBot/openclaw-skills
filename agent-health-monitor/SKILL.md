---
name: agent-health-monitor
description: Pay-per-call blockchain wallet health analytics on Base via x402. Use when the user wants to check wallet health scores, get risk assessments, optimize gas usage, retry failed transactions, set up wallet monitoring alerts, or run a full protection suite on a Base wallet address. No API keys or accounts required — pays per call with USDC on Base.
metadata: {"clawdbot": {"emoji": "🩺", "homepage": "https://agenthealthmonitor.com"}}
---

# Agent Health Monitor

Pay-per-call blockchain wallet intelligence API. Analyzes Base wallet addresses for health scores, risk levels, gas efficiency, failed transactions, and optimization opportunities.

**No accounts. No API keys. No subscriptions.** Every call is paid with USDC on Base via the x402 protocol.

## How It Works

1. Make a GET request to any paid endpoint
2. Server responds `402 Payment Required` with USDC payment instructions
3. Your x402-compatible client signs the USDC payment and resubmits
4. Server verifies payment and returns the analysis

For agents, use the [x402 Python SDK](https://pypi.org/project/x402/) or [TypeScript SDK](https://www.npmjs.com/package/x402) to handle payment automatically.

## Base URL

```
https://agenthealthmonitor.com
```

## Endpoints & Pricing

| Endpoint | Price | Description |
|----------|-------|-------------|
| `GET /risk/{address}` | $0.01 USDC | Quick risk score for pre-flight checks |
| `GET /health/{address}` | $0.50 USDC | Full wallet health score with risk analysis |
| `GET /alerts/subscribe/{address}` | $2.00 USDC/mo | Automated health monitoring & webhook alerts |
| `GET /optimize/{address}` | $5.00 USDC | Gas & strategy optimization report |
| `GET /retry/{address}` | $10.00 USDC | Analyze and retry failed transactions |
| `GET /agent/protect/{address}` | $25.00 USDC | Full protection suite (runs all services) |

Free previews available for `/retry` and `/agent/protect` (append `/preview/{address}`).

## Payment

- **Protocol**: x402 (HTTP 402 Payment Required)
- **Currency**: USDC
- **Network**: Base Mainnet (eip155:8453)
- **Facilitator**: https://facilitator.payai.network

## Endpoint Details

### GET /risk/{address} — $0.01

Quick risk score for agent pre-flight checks. Returns a 0–100 risk score and a one-line verdict. Designed for high-volume, low-latency use before interacting with an unfamiliar wallet.

**Response:**

```json
{
  "risk_score": 42,
  "risk_level": "MEDIUM",
  "verdict": "Moderate risk — elevated failure rate suggests unreliable contract interactions."
}
```

Risk levels: `LOW` (0–24), `MEDIUM` (25–49), `HIGH` (50–74), `CRITICAL` (75–100).

### GET /health/{address} — $0.50

Full wallet health diagnosis. Fetches transaction history from Blockscout, calculates success rate, gas efficiency, and nonce health, computes a composite health score (0–100), and generates optimization recommendations.

**Response:**

```json
{
  "status": "ok",
  "report": {
    "address": "0x1234...abcd",
    "is_contract": true,
    "health_score": 62.3,
    "optimization_priority": "HIGH",
    "total_transactions": 847,
    "successful": 761,
    "failed": 86,
    "success_rate_pct": 89.85,
    "total_gas_spent_eth": 0.01872,
    "wasted_gas_eth": 0.00294,
    "estimated_monthly_waste_usd": 14.70,
    "avg_gas_efficiency_pct": 71.2,
    "out_of_gas_count": 12,
    "reverted_count": 74,
    "nonce_gap_count": 3,
    "retry_count": 5,
    "top_failure_type": "reverted",
    "first_seen": "2024-06-12",
    "last_seen": "2026-02-15",
    "recommendations": [
      {
        "category": "reliability",
        "severity": "high",
        "message": "Success rate is 89.9%. Review contract interactions and add pre-flight simulation."
      }
    ],
    "eth_price_usd": 2500.00,
    "analyzed_at": "2026-02-16T20:02:19Z"
  }
}
```

Optimization priority: `LOW` (score 85+), `MEDIUM` (70–84), `HIGH` (50–69), `CRITICAL` (below 50).

### GET /alerts/subscribe/{address} — $2.00/month

Subscribe a wallet to automated health monitoring for 30 days. Checks wallet health every 6 hours and sends webhook alerts when thresholds are breached. If already subscribed, extends by 30 additional days.

After subscribing, configure your webhook with `POST /alerts/configure`:

```bash
curl -X POST https://agenthealthmonitor.com/alerts/configure \
  -H "Content-Type: application/json" \
  -d '{
    "address": "0x1234...abcd",
    "webhook_url": "https://hooks.slack.com/services/...",
    "webhook_type": "slack",
    "thresholds": {
      "health_score": 70,
      "failure_rate": 30,
      "waste_usd": 50
    }
  }'
```

Default thresholds: health score below **70**, failure rate above **30%**, monthly gas waste above **$50**.

Supports `generic`, `slack`, and `discord` webhook formats.

Related free endpoints:
- `GET /alerts/status/{address}` — check subscription status
- `DELETE /alerts/unsubscribe/{address}` — cancel subscription

### GET /optimize/{address} — $5.00

Gas optimization report. Groups transactions by type (contract + method), calculates optimal gas limits, identifies wasted gas from failed transactions, and estimates monthly savings.

**Response:**

```json
{
  "status": "ok",
  "report": {
    "address": "0x1234...abcd",
    "total_transactions_analyzed": 847,
    "current_monthly_gas_usd": 12.50,
    "optimized_monthly_gas_usd": 8.30,
    "estimated_monthly_savings_usd": 4.20,
    "total_wasted_gas_eth": 0.00294,
    "total_wasted_gas_usd": 7.35,
    "tx_types": [
      {
        "contract": "0xabcd...1234",
        "method_id": "0x3593564c",
        "method_label": "execute(bytes,bytes[],uint256)",
        "tx_count": 312,
        "failed_count": 18,
        "failure_rate_pct": 5.77,
        "current_avg_gas_limit": 250000,
        "optimal_gas_limit": 185000,
        "gas_limit_reduction_pct": 26.0,
        "wasted_gas_eth": 0.00182,
        "wasted_gas_usd": 4.55
      }
    ],
    "recommendations": [
      "Set gas limit to 185,000 for execute() calls on 0xabcd — saves ~26% gas overhead."
    ],
    "eth_price_usd": 2500.00,
    "analyzed_at": "2026-02-16T20:02:19Z"
  }
}
```

### GET /retry/{address} — $10.00

Non-custodial failed transaction retry service. Analyzes failed transactions, classifies failure reasons, and returns optimized ready-to-sign replacement transactions. Your agent signs and submits — Agent Health Monitor never touches private keys.

**Response:**

```json
{
  "status": "ok",
  "report": {
    "address": "0x1234...abcd",
    "failed_transactions_analyzed": 86,
    "retryable_count": 14,
    "retry_transactions": [
      {
        "original_tx_hash": "0xdeadbeef...",
        "failure_reason": "out_of_gas",
        "optimized_transaction": {
          "to": "0xabcd...1234",
          "data": "0x3593564c...",
          "value": "0x0",
          "gas_limit": "0x3d090",
          "max_fee_per_gas": "0x59682f00",
          "max_priority_fee_per_gas": "0x59682f00"
        },
        "estimated_gas_cost_usd": 0.12,
        "confidence": "high"
      }
    ],
    "total_estimated_retry_cost_usd": 1.68,
    "potential_value_recovered_usd": 45.00,
    "analyzed_at": "2026-02-16T20:02:19Z"
  }
}
```

Confidence: `high` (out-of-gas), `medium` (slippage reverts), `low` (other reverts).

Free preview: `GET /retry/preview/{address}` returns retryable count and estimated savings without the full transaction payloads.

### GET /agent/protect/{address} — $25.00

Autonomous protection agent that triages wallet risk and runs the appropriate combination of all services. Returns a unified report with prioritized actions ranked by potential value recovered.

**Triage logic (based on health score):**

| Health Score | Risk Level | Services Run |
|---|---|---|
| 90–100 | Low | Health check only, recommend alerts |
| 70–89 | Medium | Health check + Gas Optimizer |
| 50–69 | High | Health + Optimizer + RetryBot |
| 0–49 | Critical | All services + urgent issue flagging |

**Response:**

```json
{
  "status": "ok",
  "report": {
    "address": "0x1234...abcd",
    "risk_level": "high",
    "health_score": 58.2,
    "services_run": ["health", "optimize", "retry"],
    "summary": {
      "total_issues_found": 7,
      "total_potential_savings_usd": 18.90,
      "retry_transactions_ready": 5,
      "estimated_retry_cost_usd": 0.60
    },
    "health_report": { "..." : "..." },
    "gas_optimization": { "..." : "..." },
    "retry_transactions": ["..."],
    "recommended_actions": [
      {
        "priority": 1,
        "action": "Retry 5 failed transactions",
        "description": "Recover ~$45 in stuck value for $0.60 gas",
        "potential_value_usd": 45.00,
        "potential_savings_monthly_usd": 0
      },
      {
        "priority": 2,
        "action": "Apply gas optimizations",
        "description": "Reduce monthly gas spend by $4.20",
        "potential_value_usd": 0,
        "potential_savings_monthly_usd": 4.20
      }
    ],
    "analyzed_at": "2026-02-16T20:02:19Z"
  }
}
```

Free preview: `GET /agent/protect/preview/{address}` returns risk level and recommended services without running the full analysis.

## Example Usage

### Python with x402

```python
import httpx
from x402.client import x402_httpx

client = httpx.Client()
x402_httpx(client, wallet)  # attaches x402 payment handler

# Quick risk check before interacting with a wallet
r = client.get("https://agenthealthmonitor.com/risk/0x1234...abcd")
risk = r.json()

if risk["risk_level"] in ("HIGH", "CRITICAL"):
    print(f"Risky wallet: {risk['verdict']}")
else:
    print(f"OK to interact — risk score {risk['risk_score']}/100")
```

### TypeScript with x402

```typescript
import { wrapFetch } from "x402";

const fetch402 = wrapFetch(fetch, wallet);

const res = await fetch402(
  "https://agenthealthmonitor.com/health/0x1234...abcd"
);
const { report } = await res.json();

console.log(`Health: ${report.health_score}/100 — ${report.optimization_priority} priority`);
```

### curl (no auto-payment — returns 402)

```bash
# See payment requirements for an endpoint
curl -s https://agenthealthmonitor.com/health/0x1234...abcd

# Free endpoints work directly
curl -s https://agenthealthmonitor.com/retry/preview/0x1234...abcd
curl -s https://agenthealthmonitor.com/api/info
```

### Agent Workflow: Pre-Flight Risk Check

```python
# Before sending funds to an address, check its risk
risk = client.get(f"https://agenthealthmonitor.com/risk/{target_address}").json()

if risk["risk_score"] >= 50:
    # Abort or flag for human review
    raise Exception(f"High risk wallet: {risk['verdict']}")

# Safe to proceed with transaction
```

### Agent Workflow: Post-Failure Recovery

```python
# After detecting failed txns, preview what's recoverable (free)
preview = client.get(f"https://agenthealthmonitor.com/retry/preview/{my_wallet}").json()

if preview["retryable_count"] > 0:
    # Pay for full retry analysis
    full = client.get(f"https://agenthealthmonitor.com/retry/{my_wallet}").json()
    for tx in full["report"]["retry_transactions"]:
        if tx["confidence"] == "high":
            # Sign and submit the optimized transaction
            sign_and_send(tx["optimized_transaction"])
```

## Coupon Access

Valid coupon codes bypass x402 payment entirely:

```bash
# Use a coupon for free access to any paid endpoint
curl -s https://agenthealthmonitor.com/coupon/health/EARLY001/0x1234...abcd

# Validate a coupon code
curl -s https://agenthealthmonitor.com/coupon/validate/EARLY001
```

Coupon routes follow the pattern: `/coupon/{endpoint}/{code}/{address}`

## Service Info

```bash
# Get full endpoint list and pricing
curl -s https://agenthealthmonitor.com/api/info
```

## Resources

- **Live App**: https://agenthealthmonitor.com
- **API Docs**: https://agenthealthmonitor.com/docs
- **GitHub**: https://github.com/moonshot-cyber/agent-health-monitor
- **x402 Protocol**: https://www.x402.org
