---
name: ep-agentiam
description: AI agent safety infrastructure via x402 micropayments. Use when an agent needs pre-action risk scoring, execution integrity verification, memory state checks, tool call security validation, or a full security pipeline before executing high-value operations like trades, transfers, or contract deployments. Pay-per-call via USDC on Base — no API keys needed.
metadata:
  {
    "clawdbot":
      {
        "emoji": "🛡️",
        "homepage": "https://achillesalpha.onrender.com/ep",
        "requires": { "bins": [] },
      },
  }
---

# EP AgentIAM

Agent safety infrastructure for autonomous AI agents. Every endpoint is pay-per-call via x402 USDC micropayments on Base. No API keys — payment is the authentication.

## Base URL

```
https://achillesalpha.onrender.com
```

## Endpoints

| Endpoint | Price | Use Case |
|----------|-------|----------|
| `POST /x402/risk-check` | $0.005 | Quick risk score for any action |
| `POST /x402/riskoracle` | $0.01 | Detailed pre-action risk scoring |
| `POST /x402/noleak` | $0.01 | Execution integrity verification |
| `POST /x402/memguard` | $0.01 | Memory state verification |
| `POST /x402/secureexec` | $0.01 | Tool call security validation |
| `POST /x402/validate` | $0.01 | Policy validation |
| `POST /x402/delphi` | $0.01 | Intelligence signals |
| `POST /x402/flowcore` | $0.02 | Full pipeline (all checks in one call) |

## Quick Integration

Using x402 fetch:

```javascript
import { fetchWithPayment } from "@x402/fetch";

const res = await fetchWithPayment(
  "https://achillesalpha.onrender.com/x402/riskoracle",
  {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      agent_id: "my-agent",
      action: "swap 500 USDC to ETH",
      value: 500
    })
  },
  { privateKey: process.env.PRIVATE_KEY }
);
```

Using curl (returns 402 payment spec for testing):

```bash
curl -X POST https://achillesalpha.onrender.com/x402/riskoracle \
  -H "Content-Type: application/json" \
  -d '{"agent_id":"test","action":"swap 100 USDC"}'
```

## When to Use

- **Before trades**: Use riskoracle to score risk before executing swaps or transfers
- **Before tool calls**: Use secureexec to validate tool execution is safe
- **Memory checks**: Use memguard to verify agent memory has not been tampered with
- **Full validation**: Use flowcore ($0.02) to run all checks in one call

## Discovery

- OpenAPI: /openapi.json
- Agent card: /.well-known/agent.json
- x402 manifest: /.well-known/x402.json
- LLM docs: /llms.txt
- Status (free): /x402/status

## Network

- Payment: USDC on Base Mainnet (eip155:8453)
- Protocol: x402
- Pay to: 0x069c6012E053DFBf50390B19FaE275aD96D22ed7
