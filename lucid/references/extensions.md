# Lucid Agents Extensions

The SDK uses an extension-based architecture for composable features.

## Extension Usage

```typescript
const agent = await createAgent({
  name: 'my-agent',
  version: '1.0.0',
})
  .use(http())
  .use(wallets({ config: walletsFromEnv() }))
  .use(payments({ config: paymentsFromEnv() }))
  .use(identity({ config: identityFromEnv() }))
  .use(a2a())
  .build();
```

## Available Extensions

### http

HTTP request/response handling, streaming, SSE.

```typescript
import { http } from '@lucid-agents/http';

.use(http())
```

### payments

x402 payment verification and tracking.

```typescript
import { payments, paymentsFromEnv } from '@lucid-agents/payments';

.use(payments({ 
  config: {
    ...paymentsFromEnv(),
    policyGroups: [{
      name: 'Daily Limits',
      outgoingLimits: { global: { maxTotalUsd: 100.0, windowMs: 86400000 } },
      incomingLimits: { global: { maxTotalUsd: 5000.0, windowMs: 86400000 } },
    }],
  },
  storage: { type: 'sqlite' },
}))
```

### wallets

Wallet management for agents.

```typescript
import { wallets, walletsFromEnv } from '@lucid-agents/wallet';

.use(wallets({ config: walletsFromEnv() }))
```

### identity

ERC-8004 on-chain identity and trust.

```typescript
import { identity, identityFromEnv } from '@lucid-agents/identity';

.use(identity({ config: identityFromEnv() }))
```

### a2a

Agent-to-agent communication protocol.

```typescript
import { a2a } from '@lucid-agents/a2a';

.use(a2a())

// Call another agent
const result = await agent.a2a.client.invoke(
  'https://other-agent.com',
  'skillId',
  { input: 'data' }
);
```

### analytics

Payment analytics and reporting.

```typescript
import { analytics, getSummary, exportToCSV } from '@lucid-agents/analytics';

.use(analytics())

// Get summary
const summary = await getSummary(agent.analytics.paymentTracker, 86400000);

// Export CSV
const csv = await exportToCSV(agent.analytics.paymentTracker);
```

## Adapters

### Hono (Recommended)

Lightweight, edge-compatible.

```typescript
import { createAgentApp } from '@lucid-agents/hono';

const { app, addEntrypoint } = await createAgentApp(agent);

export default { port: 3000, fetch: app.fetch };
```

### Express

Traditional Node.js server.

```typescript
import { createAgentApp } from '@lucid-agents/express';

const { app, addEntrypoint } = await createAgentApp(agent);

app.listen(3000);
```

### TanStack Start

Full-stack React with dashboard.

```typescript
import { createTanStackRuntime } from '@lucid-agents/tanstack';

const { runtime, handlers } = await createTanStackRuntime(agent);

runtime.addEntrypoint({ ... });

export { runtime, handlers };
```

## Payment Networks

**EVM:**
- `base` - Base mainnet (recommended, low cost)
- `base-sepolia` - Base testnet
- `ethereum` - Ethereum mainnet
- `sepolia` - Ethereum testnet

**Solana:**
- `solana` - Solana mainnet
- `solana-devnet` - Solana devnet

## Environment Variables

```bash
# Required for payments
PAYMENTS_RECEIVABLE_ADDRESS=0xYourWallet
FACILITATOR_URL=https://facilitator.daydreams.systems
NETWORK=base

# Optional for identity
IDENTITY_REGISTRY_ADDRESS=0x...
IDENTITY_PRIVATE_KEY=0x...

# Optional for wallets
AGENT_WALLET_PRIVATE_KEY=0x...
```
