---
name: morv
description: >
  Onchain agent runtime for Base (8453) with AgentGuard spend policies, MCP tool marketplace,
  x402 pay-per-request APIs, and BYOM models — settled via Bankr wallet or direct Base USDC.
  Use when building custom autonomous agents that install MCP tools, enforce per-agent spending
  limits (daily/per-tx/category/anomaly), run multi-agent CLI workflows, or embed MorvClient
  in TypeScript. Not for simple Bankr trading prompts — use the bankr skill for swaps,
  transfers, and natural-language DeFi via bankr agent prompt.
metadata:
  {
    "clawdbot":
      {
        "emoji": "🛡️",
        "homepage": "https://morv.run",
        "requires": { "bins": [] },
      },
  }
---

# Morv — Onchain Agent Runtime for Base

**SDK:** `@morv-labs/morv` · **CLI:** `npx morv` · **Chain:** Base 8453 · **Wallet:** Bankr (recommended)

Morv runs the full agent loop — **BYOM model → MCP tools / x402 APIs → AgentGuard → Bankr wallet pay → answer** — so autonomous agents call paid tools without draining wallets.

---

## When to use Morv vs Bankr

| Task | Use |
|------|-----|
| Swap, transfer, deploy token via natural language | **bankr** skill (`bankr agent prompt`) |
| Custom agent with your own model (Groq, OpenAI, Anthropic) | **morv** |
| Install & run MCP tools (`morv add`, marketplace) | **morv** |
| Per-agent spend policy (daily, per-tx, category, anomaly, whitelist) | **morv** (AgentGuard) |
| Multi-agent CLI (`morv agent create`, `guard status`) | **morv** |
| Embed agent runtime in TypeScript (`MorvClient`) | **morv** |
| x402 discovery on Bankr ecosystem | **morv** (`base-x402-discovery` → `x402.bankr.bot`) |

Bankr provides the **wallet and onchain settlement**. Morv provides the **agent runtime and guardrails** on top.

---

## Prerequisites

- Node.js 18+
- **BYOM key** — e.g. `GROQ_API_KEY` (free tier) or `OPENAI_API_KEY`
- **Morv API key** — sign in at [morv.run](https://morv.run), then `morv login --key mv_...`
- **Bankr wallet** (recommended for onchain path): `BANKR_API_KEY` + `BANKR_AGENT_ADDRESS`
- Alternative wallet: `MORV_WALLET_PRIVATE_KEY` (direct viem USDC on Base)

**Never commit** `.env`, `.morv/`, or private keys.

---

## Quick Start

```bash
npm install @morv-labs/morv
npx morv init
```

`.env` minimum:

```env
GROQ_API_KEY=gsk_...
MORV_API_KEY=mv_...
BANKR_API_KEY=bk_...
BANKR_AGENT_ADDRESS=0x...
X402_PROVIDER=bankr
```

```bash
npx morv agent create dca-bot \
  --tools base-x402-discovery \
  --daily 200 \
  --per-tx 50

npx morv add base-x402-discovery
npx morv run "Aggregate DeFi TVL from all x402 sources on Base"
npx morv guard status dca-bot
```

---

## Agent Loop

```
prompt → BYOM model → (optional) MCP tool or x402 API
       → AgentGuard.check → wallet.pay (Bankr/Base) → result → model → answer
```

---

## MCP Tool Catalog

Install with `npx morv add <tool-id>`:

| ID | Category |
|----|----------|
| `base-x402-discovery` | x402 service discovery (Bankr + CDP) |
| `base-web-scraper` | Web data |
| `base-eth-price` | Price oracle |
| `base-onchain-tools` | AgentKit onchain actions |
| `baselings-defi` | DeFi tools |

Search marketplace: `npx morv tools search defi`

---

## Example Prompts

Use patterns that show **autonomy + payments**, not generic price checks:

```
Scan Base pools and DCA $50 if ETH dips 3%
Aggregate DeFi TVL from all x402 sources
Summarize Base agent ecosystem news this week
Run swarm: researcher finds yield, trader allocates $80
```

---

## CLI Overview

| Command | Purpose |
|---------|---------|
| `morv init` | Initialize project + `.morv/config.json` |
| `morv login --key mv_...` | Save Morv API key |
| `morv setup` | Update model / Morv API keys |
| `morv agent create <id>` | Create agent with policy + tools |
| `morv agent list` | List configured agents |
| `morv add <toolId>` | Install MCP tool |
| `morv run "<prompt>"` | Run full agent loop |
| `morv run -t <toolId> --input '{}'` | Call single MCP tool |
| `morv guard status [id]` | AgentGuard spend status |
| `morv guard pause/resume <id>` | Manual pause/resume |
| `morv guard history <id>` | Transaction ledger |
| `morv monitor [id]` | Live budget watch |
| `morv tools search/list` | Marketplace browse |
| `morv billing usage` | Usage summary (hosted API) |

Full CLI reference: [references/cli.md](references/cli.md)

---

## SDK Quick Reference

```typescript
import {
  MorvClient,
  AgentGuard,
  createPlatformWalletFromEnv,
  PolicyViolationError,
} from '@morv-labs/morv';

const morv = new MorvClient({
  apiBaseUrl: 'https://api.morv.run',
  apiKey: process.env.MORV_API_KEY!,
});

const wallet = createPlatformWalletFromEnv(); // Bankr or Base from env

const agent = await morv.createAgent(
  {
    id: 'dca-bot',
    model: { provider: 'groq', model: 'llama-3.3-70b-versatile', apiKey: process.env.GROQ_API_KEY! },
    policy: { dailyLimitUsd: 200, perTxLimitUsd: 50, autoPause: true },
    tools: ['base-x402-discovery', 'base-web-scraper'],
  },
  wallet
);

const answer = await agent.run('Scan Base pools and DCA if ETH dips 3%');
console.log(agent.status());
```

Full SDK reference: [references/sdk.md](references/sdk.md)

---

## AgentGuard Policies

Every payment path (MCP quote, x402 402 response, direct `agent.pay()`) passes through AgentGuard:

| Check | Example |
|-------|---------|
| Per-tx limit | Block $500 when cap is $50 |
| Daily budget | Pause at $200/day |
| Category limits | Cap `api` vs `trading` spend separately |
| Anomaly detection | Velocity spike → auto-pause |
| Whitelist / blacklist | Restrict recipient addresses |

```typescript
import { PolicyViolationError } from '@morv-labs/morv';

try {
  await agent.pay({ to: '0x...', amount: 99, currency: 'USDC', category: 'api' });
} catch (err) {
  if (err instanceof PolicyViolationError) console.log('Blocked:', err.reason);
}
```

Policy fields: `dailyLimitUsd`, `weeklyLimitUsd`, `monthlyLimitUsd`, `perTxLimitUsd`, `whitelist`, `blacklist`, `categoryLimits`, `maxTxPerMinute`, `maxTxPerHour`, `anomalyMultiplier`, `autoPause`, `pauseStrategy`, `alertWebhook`.

---

## x402 with Bankr

Default provider: `X402_PROVIDER=bankr`

- Discovery tool queries `https://x402.bankr.bot`
- `BankrX402Client` wraps x402-fetch on Base when `MORV_WALLET_PRIVATE_KEY` is set
- Fallback: Morv header flow → AgentGuard → Bankr wallet transfer → retry with payment proof

For Bankr-native x402 calls inside the Bankr agent (no custom loop), use the **bankr** skill instead.

---

## Onchain Constants

| Name | Value |
|------|-------|
| Chain | Base 8453 |
| USDC | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
| Decimals | 6 |

---

## Safety

- AgentGuard is a **second layer** on top of Bankr wallet limits — configure both
- Use a **dedicated Bankr agent wallet** with limited USDC for autonomous runs
- Use Bankr **read-only** API keys for monitoring-only agents
- Start with low `--daily` and `--per-tx` limits; scale after testing on Base
- Never store `BANKR_API_KEY`, `MORV_API_KEY`, or private keys in source code

Full safety guide: [references/safety.md](references/safety.md)

---

## Resources

- **Website:** https://morv.run
- **npm:** https://www.npmjs.com/package/@morv-labs/morv
- **GitHub:** https://github.com/Morv-Labs/morv
- **Quickstart:** https://github.com/Morv-Labs/morv/blob/main/QUICKSTART.md
- **Architecture:** https://github.com/Morv-Labs/morv/blob/main/docs/ARCHITECTURE.md
- **X:** https://x.com/morvlabs
- **Bankr x402:** https://x402.bankr.bot
