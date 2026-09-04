# Compliance Screening

OFAC/SDN wallet screening for autonomous agents via the Shulam CaaS API.

## Capabilities

- Screen Ethereum wallet addresses against OFAC SDN (Specially Designated Nationals) and other sanctions lists
- Batch screening — screen up to 50 addresses in a single call
- Real-time status: `clear` (no match), `held` (partial match, under review), `blocked` (confirmed match)
- Automatic exponential backoff on rate limits (429)
- Zero external dependencies — uses raw `fetch` only

## Usage Examples

```typescript
import { screenWallet, screenWallets } from './scripts/index.js';

// Single address screening
const result = await screenWallet('0x1234...');
console.log(result.status); // 'clear' | 'held' | 'blocked'
console.log(result.matchScore); // 0.0 - 1.0

// Batch screening (up to 50)
const results = await screenWallets(['0x1234...', '0x5678...']);
results.forEach(r => console.log(`${r.status}: score=${r.matchScore}`));
```

**Response shape:**
```json
{
  "status": "clear",
  "matchScore": 0.0,
  "screenedAt": "2026-02-19T12:00:00.000Z",
  "listsChecked": ["OFAC_SDN"],
  "holdId": null
}
```

## Requirements

- **`SHULAM_API_KEY`** (required) — Get a free key (100 screens/day) at [api.shulam.xyz/register](https://api.shulam.xyz/register)
- **`SHULAM_API_URL`** (optional) — API base URL, defaults to `https://api.shulam.xyz`
- Node.js 18+ (for native `fetch`)

Powered by [Shulam](https://shulam.xyz) — enterprise-grade x402 payment facilitation with built-in compliance.
