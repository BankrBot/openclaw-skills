# Aegis402 Shield Protocol

Blockchain security API for AI agents. Pay-per-request via x402 protocol.

## What It Does

- **Token Scanning** — Honeypot detection, rug pull warnings, trust scores
- **Transaction Simulation** — Preview balance changes before signing
- **Address Verification** — Detect poisoning attacks, known scam addresses

## Quick Integration

```typescript
import { x402Client, wrapFetchWithPayment } from '@x402/fetch';
import { ExactEvmScheme } from '@x402/evm/exact/client';

const client = new x402Client().register('eip155:*', new ExactEvmScheme(wallet));
const fetch402 = wrapFetchWithPayment(fetch, client);

// Check token before buying
const { isHoneypot, trustScore } = await fetch402(
  'https://aegis402.xyz/v1/check-token/0x...?chain_id=8453'
).then(r => r.json());
```

## Pricing

| Endpoint | Price |
|----------|-------|
| `/v1/simulate-tx` | $0.05 |
| `/v1/check-token/:address` | $0.01 |
| `/v1/check-address/:address` | $0.005 |

## Links

- [Website](https://aegis402.xyz)
- [Full Documentation](./SKILL.md)
