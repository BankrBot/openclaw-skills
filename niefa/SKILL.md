# NIEFA Skill

**Neural Interference Engine for Agents**  
Deploy autonomous AI agents that think, plan, and execute tasks independently.

Source: https://github.com/niefa-xyz/niefa  
Website: https://niefa.xyz

## Overview

NIEFA is an open-source platform for running **goal-driven autonomous agents**. You describe an objective in natural language; NIEFA breaks it into a step-by-step plan using the Bankr LLM Gateway, dispatches it to the Bankr Agent API, and streams real-time progress into an interactive dashboard.

## Capabilities

| Capability | Description |
|---|---|
| **Autonomous Agents** | Submit a natural-language goal → agent plans, executes, self-corrects |
| **LLM Plan Generation** | Uses `claude-haiku-4-5` via Bankr LLM Gateway to produce 5–7 ordered steps |
| **Bankr Agent Integration** | Dispatches to `POST /agent/prompt`, polls `GET /agent/job/{id}` |
| **Wallet Dashboard** | Live wallet address, USD portfolio value, token balances across chains |
| **Token Launcher** | Deploy ERC-20 on Base (1.2% swap fee, 57% to creator) via Bankr |
| **x402 Paid Endpoints** | Register and protect API endpoints with USDC micropayments (x402 protocol) |
| **Agent File System** | Per-agent sandboxed storage — read, write, list, delete artifacts across runs |

## Integration

NIEFA exposes the following REST endpoints that other agents can call:

### Agent Execution
```
POST /api/bankr/agent   { prompt, threadId?, maxMode? }  → { jobId, threadId }
GET  /api/bankr/job/{jobId}                              → { status, response }
```

### Wallet & Tokens
```
GET  /api/bankr/wallet                     → { info, portfolio }
POST /api/bankr/token  { name, symbol }    → { tokenAddress, txHash }
GET  /api/bankr/token/{addr}/fees          → { claimableFees }
POST /api/bankr/token/{addr}/fees          → claim fees
```

### x402 Paid Endpoints (NIEFA-native)
```
GET  /api/niefa/x402                                  → list registered endpoints
POST /api/niefa/x402  { action:'register', slug, price }  → create paid endpoint
POST /api/niefa/x402  { action:'request', slug }       → get 402 + payment details
POST /api/niefa/x402  { action:'pay', slug, txHash, payer }  → submit payment proof
DELETE /api/niefa/x402?slug=                          → remove endpoint
```

### Agent File System (NIEFA-native)
```
GET    /api/niefa/fs?agent={id}&path=/         → list files
GET    /api/niefa/fs?agent={id}&path=/file.txt → read file
POST   /api/niefa/fs  { agent, path, content } → write file (max 1 MB)
DELETE /api/niefa/fs?agent={id}&path=/file.txt → delete file
GET    /api/niefa/fs?agent={id}&info=1         → storage usage
```

## Quick Start

```bash
git clone https://github.com/niefa-xyz/niefa.git
cd niefa
cp .env.example .env.local
# Add BANKR_API_KEY=bk_... to .env.local
npm install && npm run dev
```

Open http://localhost:3000 → `/#deploy` to run an agent goal end-to-end.

## Graceful Degradation

When `BANKR_API_KEY` is absent, all Bankr routes return `501 Not Configured` and the UI falls back to a simulated task sequence. The demo always works without a key.

## Tech Stack

Next.js 15 · TypeScript · Bankr API · x402 · Tailwind CSS

## License

MIT
