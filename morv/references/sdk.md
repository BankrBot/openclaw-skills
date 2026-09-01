# Morv SDK Reference

Package: `@morv-labs/morv`

## Core Exports

| Export | Purpose |
|--------|---------|
| `MorvClient` | Agent lifecycle, marketplace, billing |
| `Agent` | Single agent instance (run, pay, useTool, fetch) |
| `AgentGuard` | Standalone policy engine on any payment path |
| `McpRegistry` / `McpGateway` | Local + remote MCP tool execution |
| `X402Client` / `BankrX402Client` | HTTP 402 pay-per-request |
| `createX402Client` | Factory (`X402_PROVIDER=bankr` default) |
| `createPlatformWalletFromEnv` | Bankr or Base wallet from env |
| `createModelRunner` | BYOM adapter (Groq, OpenAI, Anthropic, Gemini, Ollama) |
| `listBaseMcpTools` | Base MCP catalog |

## Minimal Example

```typescript
import { MorvClient, createPlatformWalletFromEnv } from '@morv-labs/morv';

const morv = new MorvClient({
  apiBaseUrl: process.env.MORV_API_BASE_URL ?? 'https://api.morv.run',
  apiKey: process.env.MORV_API_KEY!,
});

const wallet = createPlatformWalletFromEnv();

const agent = await morv.createAgent(
  {
    id: 'research-bot',
    model: {
      provider: 'groq',
      model: 'llama-3.3-70b-versatile',
      apiKey: process.env.GROQ_API_KEY!,
    },
    policy: {
      dailyLimitUsd: 100,
      perTxLimitUsd: 25,
      autoPause: true,
      categoryLimits: { api: 50, mcp: 75 },
    },
    tools: ['base-x402-discovery', 'base-web-scraper'],
  },
  wallet
);

// Full loop
const answer = await agent.run('Summarize Base agent ecosystem news this week');

// Direct MCP tool
const discovery = await agent.useTool('base-x402-discovery', { query: 'defi' });

// x402 paid API (AgentGuard enforced)
const data = await agent.fetch('https://api.example.com/paid-endpoint');

// Direct payment (policy-checked)
await agent.pay({
  to: '0xRecipient...',
  amount: 5,
  currency: 'USDC',
  category: 'api',
  memo: 'x402 settlement',
});

console.log(agent.status());
agent.guard.destroy();
```

## Environment Variables

| Variable | Notes |
|----------|-------|
| `GROQ_API_KEY` | Groq BYOM (free tier) |
| `OPENAI_API_KEY` | OpenAI BYOM |
| `BANKR_API_KEY` | Bankr wallet (recommended) |
| `BANKR_AGENT_ADDRESS` | With Bankr wallet |
| `MORV_WALLET_PRIVATE_KEY` | Direct viem USDC on Base |
| `MORV_API_KEY` | Hosted gateway at morv.run |
| `MORV_API_BASE_URL` | Default `https://api.morv.run` |
| `X402_PROVIDER` | `bankr` (default) or `morv` |
| `BASE_RPC_URL` | Default `https://mainnet.base.org` |

## Errors

- `PolicyViolationError` — payment blocked by AgentGuard policy
- `AgentPausedError` — agent paused (auto or manual)
- `AnomalyDetectedError` — velocity/amount anomaly triggered pause
- `InsufficientCreditsError` — Morv credits exhausted (hosted mode)
