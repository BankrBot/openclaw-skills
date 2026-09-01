---
name: aegis402
description: Blockchain security API for AI agents. Use when the agent needs to verify token safety before buying, simulate transactions before signing, or check addresses for poisoning attacks. Provides automated on-chain threat detection with pay-per-request pricing via x402 protocol.
---

# Aegis402 Shield Protocol

Blockchain security API for AI agents. Automated on-chain threat detection with pay-per-request pricing.

**Website:** https://aegis402.xyz
**API Base:** `https://aegis402.xyz/v1`

## When to Use This Skill

Use Aegis402 when your agent needs to:
- **Check a token before buying** — Detect honeypots, rug pulls, high-risk tokens
- **Simulate a transaction before signing** — Preview balance changes, catch approval traps
- **Verify a recipient address** — Detect address poisoning, known scam addresses

## Quick Start

```typescript
import { x402Client, wrapFetchWithPayment } from '@x402/fetch';
import { ExactEvmScheme } from '@x402/evm/exact/client';

const client = new x402Client()
  .register('eip155:*', new ExactEvmScheme(yourEvmWallet));

const fetch402 = wrapFetchWithPayment(fetch, client);

// Check if token is a honeypot before buying
const check = await fetch402('https://aegis402.xyz/v1/check-token/0x...?chain_id=8453');
const { isHoneypot, trustScore } = await check.json();

if (isHoneypot || trustScore < 50) {
  // ABORT — risky token detected
}
```

**Requirements:** USDC on Base Mainnet or Solana Mainnet for payments.

---

## Pricing

| Endpoint | Price | Use Case |
|----------|-------|----------|
| `POST /v1/simulate-tx` | $0.05 | Transaction simulation |
| `GET /v1/check-token/:address` | $0.01 | Token honeypot detection |
| `GET /v1/check-address/:address` | $0.005 | Address reputation check |

---

## Endpoints

### Check Token ($0.01)

Scan any token for honeypots, scams, and risks before buying.

```bash
curl "https://aegis402.xyz/v1/check-token/0xTokenAddress?chain_id=8453"
```

**Response:**
```json
{
  "address": "0x...",
  "isHoneypot": false,
  "trustScore": 95,
  "risks": []
}
```

### Check Address ($0.005)

Verify if address is flagged for phishing or poisoning attacks.

```bash
curl "https://aegis402.xyz/v1/check-address/0xRecipientAddress"
```

**Response:**
```json
{
  "address": "0x...",
  "isPoisoned": false,
  "reputation": "NEUTRAL",
  "tags": ["wallet", "established"]
}
```

### Simulate Transaction ($0.05)

Predict balance changes and detect threats before signing.

```bash
curl -X POST "https://aegis402.xyz/v1/simulate-tx" \
  -H "Content-Type: application/json" \
  -d '{
    "from": "0xYourWallet",
    "to": "0xContract",
    "value": "1000000000000000000",
    "data": "0x...",
    "chain_id": 8453
  }'
```

**Response:**
```json
{
  "isSafe": true,
  "riskLevel": "LOW",
  "simulation": {
    "balanceChanges": [
      { "asset": "USDC", "amount": "-100.00" }
    ]
  },
  "warnings": []
}
```

---

## Integration Patterns

### Pattern 1: Pre-Swap Safety Check

Before executing any token swap:

```typescript
async function safeSwap(tokenAddress: string, chain_id: number) {
  // 1. Check token safety first
  const tokenCheck = await fetch402(
    `https://aegis402.xyz/v1/check-token/${tokenAddress}?chain_id=${chain_id}`
  );
  const { isHoneypot, trustScore, risks } = await tokenCheck.json();

  if (isHoneypot) {
    throw new Error('HONEYPOT DETECTED — aborting swap');
  }

  if (trustScore < 50) {
    throw new Error(`LOW TRUST SCORE (${trustScore}) — aborting swap`);
  }

  // 2. Proceed with swap only if safe
  return executeSwap(tokenAddress);
}
```

### Pattern 2: Transaction Simulation Before Signing

Never sign without simulation:

```typescript
async function safeSend(tx: Transaction) {
  // 1. Simulate first
  const simulation = await fetch402('https://aegis402.xyz/v1/simulate-tx', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(tx)
  });

  const { isSafe, riskLevel, warnings } = await simulation.json();

  if (!isSafe || riskLevel === 'CRITICAL') {
    throw new Error(`DANGEROUS TX: ${warnings.join(', ')}`);
  }

  // 2. Only sign if simulation passes
  return signAndSend(tx);
}
```

### Pattern 3: Address Verification Before Transfer

Always verify recipient addresses:

```typescript
async function safeTransfer(to: string, amount: bigint) {
  // 1. Check for address poisoning
  const addrCheck = await fetch402(
    `https://aegis402.xyz/v1/check-address/${to}`
  );
  const { isPoisoned, reputation } = await addrCheck.json();

  if (isPoisoned) {
    throw new Error('ADDRESS POISONING DETECTED — possible scam');
  }

  // 2. Transfer only to verified addresses
  return transfer(to, amount);
}
```

---

## Risk Levels

| Level | Meaning | Action |
|-------|---------|--------|
| `SAFE` | No issues detected | Proceed |
| `LOW` | Minor concerns | Proceed with caution |
| `MEDIUM` | Some risks | Review before proceeding |
| `HIGH` | Significant risks | Avoid unless necessary |
| `CRITICAL` | Do not proceed | ABORT |

---

## Supported Chains

| Chain | ID | check-token | check-address | simulate-tx |
|-------|-----|-------------|---------------|-------------|
| Ethereum | 1 | ✅ | ✅ | ✅ |
| Base | 8453 | ✅ | ✅ | ✅ |
| Polygon | 137 | ✅ | ✅ | ✅ |
| Arbitrum | 42161 | ✅ | ✅ | ✅ |
| Optimism | 10 | ✅ | ✅ | ✅ |
| BSC | 56 | ✅ | ✅ | ✅ |
| Avalanche | 43114 | ✅ | ✅ | ✅ |

---

## Complementary with Local Guardrails

Aegis402 provides **external verification** that complements client-side security rules:

| Local Guardrails | Aegis402 API |
|-----------------|--------------|
| "Never approve unknown contracts" | → Verify contract risk before approval |
| "Simulate before signing" | → Provides the simulation |
| "Check destination addresses" | → Detects poisoning attacks |
| "Validate token before buying" | → Honeypot detection |

Use both for defense in depth.

---

## Links

- **Website**: https://aegis402.xyz
- **API Docs**: https://aegis402.xyz/api.html
- **Demo**: https://aegis402.xyz/demo.html
- **x402 Protocol**: https://docs.x402.org
