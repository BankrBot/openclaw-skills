# Trust Scoring

Agent trust scores and wallet reputation via the Shulam Agent Passport API.

## Capabilities

- Retrieve trust scores (0-100) and tier classification for any wallet address
- 6-dimension breakdown: volume, reliability, compliance, diversity, longevity, stability
- Configurable minimum trust threshold via `MIN_TRUST_SCORE`
- Combined compliance + trust check in a single call (`combinedCheck`)
- 60-second in-memory cache to reduce API calls
- Zero external dependencies — uses raw `fetch` only

## Usage Examples

```typescript
import { getTrustScore, combinedCheck } from './scripts/index.js';

// Trust score lookup
const score = await getTrustScore('0x1234...');
console.log(score.score);     // 72
console.log(score.tier);      // 'trusted'
console.log(score.breakdown); // { volume: 80, reliability: 75, ... }

// Combined: compliance screen + trust score (parallel)
const check = await combinedCheck('0x1234...');
console.log(check.compliance.status); // 'clear'
console.log(check.trust.score);       // 72
console.log(check.trust.meetsThreshold); // true
```

**Tier classification:**

| Tier | Score Range | Meaning |
|------|------------|---------|
| `unknown` | — | No transaction history |
| `new` | 0-25 | Recently active |
| `established` | 26-50 | Consistent history |
| `trusted` | 51-75 | Strong track record |
| `exemplary` | 76-100 | Top-tier reputation |

## Requirements

- **`SHULAM_API_KEY`** (required) — Get a free key (100 lookups/day) at [api.shulam.xyz/register](https://api.shulam.xyz/register)
- **`SHULAM_API_URL`** (optional) — API base URL, defaults to `https://api.shulam.xyz`
- **`MIN_TRUST_SCORE`** (optional) — Minimum trust score threshold (0-100, default: 0)
- Node.js 18+ (for native `fetch`)

Powered by [Shulam](https://shulam.xyz) — enterprise-grade x402 payment facilitation with built-in compliance.
