---
name: agentrisk
description: Pre-trade risk scoring for Base tokens. Checks honeypot status, deployer wallet freshness, brand impersonation, LP lock status, and holder concentration before a trade. Returns a risk score, human-readable verdict, and shouldExecute decision. Paid per call via x402 (0.15 USDC), no API key required.
---

# AgentRisk

Pre-trade security layer for autonomous agents trading on Base. Before executing a swap, call AgentRisk to check whether the target token is safe.

## When to use this skill

Use this BEFORE buying or swapping into any Base token whose safety is unknown or unverified — especially freshly launched tokens with no established track record.

## How it works

1. Call `GET https://agentrisk.dev/scan?token=<CONTRACT_ADDRESS>`
2. The endpoint returns `402 Payment Required` with x402 payment details (0.15 USDC on Base, settled via Coinbase's official facilitator)
3. Pay and retry — you receive a full risk report

## What it checks

- Honeypot detection (can the token actually be sold?)
- Ownership renouncement and pausability
- LP lock/burn status, cross-checked against a direct on-chain read
- Holder concentration
- Deployer wallet freshness (is this a brand-new, one-off wallet?)
- Brand impersonation (does the name/symbol mimic a known company?)
- Data source disagreement (do GoPlus and our own on-chain check conflict?)

## Example response

Real scan of a confirmed honeypot token:

```json
{
  "riskScore": 100,
  "riskLevel": "CRITICAL_HONEYPOT",
  "verdict": "DO NOT TRADE. Token cannot be sold (honeypot) or sells are blocked; Contract exposes a mint function (supply can be increased).",
  "confidence": "high",
  "shouldExecute": false
}
```

## Notes

- Only Base Mainnet (chain 8453) is supported.
- Repeat scans of the same token within 5 minutes are served from cache in under 1ms.
- Every response includes a `scan_id` and `timestamp` for auditability.
- `confidence` is explicitly marked `"low"` when key data (deployer address, LP lock status) could not be verified — we do not silently treat missing data as safe.

Source: https://github.com/Neurobyteio/agentrisk
