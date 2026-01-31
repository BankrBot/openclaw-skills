---
name: lucid-agents
description: |
  Build and monetize AI agents with x402 micropayments using the Lucid Agents SDK.
  Use this skill when: building paid API agents, creating x402 entrypoints, deploying
  to Railway, or running automated agent factory pipelines.

see-also:
  - https://github.com/daydreamsai/lucid-agents: Lucid Agents SDK monorepo
  - https://x402.org: x402 micropayment protocol
---

# Lucid Agents SDK

TypeScript framework for building and monetizing AI agents with x402 micropayments.

## Quick Start

```bash
# Create a new agent
bunx @lucid-agents/cli my-agent --adapter=hono

# Or manual setup
mkdir my-agent && cd my-agent
bun init
bun add @lucid-agents/core @lucid-agents/http @lucid-agents/hono @lucid-agents/payments hono zod@4
```

## Minimal Agent

```typescript
import { createAgent } from '@lucid-agents/core';
import { http } from '@lucid-agents/http';
import { createAgentApp } from '@lucid-agents/hono';
import { payments, paymentsFromEnv } from '@lucid-agents/payments';
import { z } from 'zod';  // MUST BE v4!

const agent = await createAgent({
  name: 'my-agent',
  version: '1.0.0',
})
  .use(http())
  .use(payments({ config: paymentsFromEnv() }))
  .build();

const { app, addEntrypoint } = await createAgentApp(agent);

// Free endpoint
addEntrypoint({
  key: 'overview',
  description: 'Free preview',
  input: z.object({}),
  price: { amount: 0 },
  handler: async () => ({ output: { message: 'Hello!' } }),
});

// Paid endpoint ($0.001 = 1000 microunits)
addEntrypoint({
  key: 'lookup',
  description: 'Look up data',
  input: z.object({ query: z.string() }),
  price: { amount: 1000 },
  handler: async (ctx) => {
    const data = await fetch(`https://api.example.com/${ctx.input.query}`).then(r => r.json());
    return { output: data };
  },
});

export default { port: Number(process.env.PORT ?? 3000), fetch: app.fetch };
```

## Required Environment Variables

```bash
PAYMENTS_RECEIVABLE_ADDRESS=0xYourWalletAddress
FACILITATOR_URL=https://facilitator.daydreams.systems
NETWORK=base  # or base-sepolia, ethereum, solana
```

## Package.json (CRITICAL: Zod v4!)

```json
{
  "name": "my-agent",
  "type": "module",
  "dependencies": {
    "@lucid-agents/core": "latest",
    "@lucid-agents/http": "latest",
    "@lucid-agents/hono": "latest",
    "@lucid-agents/payments": "latest",
    "hono": "^4.0.0",
    "zod": "^4.0.0"
  }
}
```

## Endpoint Patterns

### Free Preview Endpoint
Always include one free endpoint so agents can discover your API:

```typescript
addEntrypoint({
  key: 'overview',
  description: 'Free overview - try before you buy',
  input: z.object({}),
  price: { amount: 0 },
  handler: async () => {
    const data = await fetch('https://api.example.com/summary').then(r => r.json());
    return { output: { summary: data, fetchedAt: new Date().toISOString() } };
  },
});
```

### Tiered Pricing Pattern

```typescript
// Basic lookup: $0.001
addEntrypoint({
  key: 'lookup',
  input: z.object({ id: z.string() }),
  price: { amount: 1000 },
  handler: async (ctx) => { /* ... */ },
});

// Search with filters: $0.002
addEntrypoint({
  key: 'search',
  input: z.object({ query: z.string(), limit: z.number().default(10) }),
  price: { amount: 2000 },
  handler: async (ctx) => { /* ... */ },
});

// Aggregated report: $0.005
addEntrypoint({
  key: 'report',
  input: z.object({ subject: z.string() }),
  price: { amount: 5000 },
  handler: async (ctx) => {
    const [source1, source2] = await Promise.all([
      fetch(`https://api1.example.com/${ctx.input.subject}`).then(r => r.json()),
      fetch(`https://api2.example.com/${ctx.input.subject}`).then(r => r.json()),
    ]);
    return { output: { ...source1, ...source2, generatedAt: new Date().toISOString() } };
  },
});
```

### Streaming Endpoint

```typescript
addEntrypoint({
  key: 'chat',
  description: 'Chat with AI',
  input: z.object({ message: z.string() }),
  price: { amount: 5000 },
  streaming: true,
  async stream(ctx, emit) {
    const stream = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [{ role: 'user', content: ctx.input.message }],
      stream: true,
    });
    
    for await (const chunk of stream) {
      await emit({ kind: 'delta', delta: chunk.choices[0]?.delta?.content ?? '' });
    }
    
    return { output: { completed: true } };
  },
});
```

## Available Packages

| Package | Purpose |
|---------|---------|
| `@lucid-agents/core` | Protocol-agnostic runtime |
| `@lucid-agents/http` | HTTP extension |
| `@lucid-agents/hono` | Hono adapter |
| `@lucid-agents/express` | Express adapter |
| `@lucid-agents/tanstack` | TanStack Start adapter |
| `@lucid-agents/payments` | x402 payment utilities |
| `@lucid-agents/identity` | ERC-8004 identity |
| `@lucid-agents/a2a` | Agent-to-agent protocol |
| `@lucid-agents/wallet` | Wallet SDK |
| `@lucid-agents/analytics` | Payment analytics |
| `@lucid-agents/cli` | CLI scaffolding |

## Deploy to Railway

```bash
# Create and push to GitHub
git init && git add . && git commit -m "Initial commit"
gh repo create my-username/my-agent --public --source=. --push

# Deploy to Railway
railway init
railway variables set \
  PAYMENTS_RECEIVABLE_ADDRESS=0xYourWallet \
  FACILITATOR_URL=https://facilitator.daydreams.systems \
  NETWORK=base
railway up
railway domain  # Get your public URL
```

## Common Errors

| Error | Fix |
|-------|-----|
| `z.toJSONSchema is not a function` | Upgrade to Zod v4: `bun add zod@4` |
| `PAYMENTS_RECEIVABLE_ADDRESS not set` | Set required env vars |
| `EADDRINUSE` | Don't call `Bun.serve()` - use `export default` |
| 404 on endpoint | Check path: `/entrypoints/{key}/invoke` |

## B2A (Business-to-Agent) Pattern

Build agents that serve other agents:

**Good B2A agents:**
- Aggregated data from multiple sources
- Normalized/cleaned data feeds
- Hard-to-get or rate-limited data
- Cross-platform correlation
- Real-time feeds

**High-value niches:**
- Price feeds (crypto, forex, commodities)
- Entity resolution (company/person/domain lookup)
- News & events aggregation
- Social signals (trending topics, sentiment)
- Geolocation services
- Rate-limit wrapping (cached scarce APIs)

## Agent Factory Pipeline

Automated workflow for building agents:

1. **DISCOVER** - Find trending topics/data needs
2. **EVALUATE** - Score for B2A monetization (≥7 to proceed)
3. **RESEARCH** - Find real, live data APIs
4. **BUILD** - Create 5 paid + 1 free endpoint
5. **TEST** - Self-test all endpoints with real data
6. **DEPLOY** - Ship to Railway
7. **ANNOUNCE** - Tweet/post about launch

## Resources

- [Lucid Agents SDK](https://github.com/daydreamsai/lucid-agents)
- [x402 Protocol](https://x402.org)
- [ERC-8004 Spec](https://eips.ethereum.org/EIPS/eip-8004)
- [Public APIs](https://github.com/public-apis/public-apis)
