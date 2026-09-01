---
name: blueagent
description: >
  Base-native AI agent for builders — idea, build, audit, ship, raise.
  31 CLI commands and 6 MCP tools grounded in real Base knowledge.
  Powered by Bankr LLM. Collab-ready: accepts signals from Aeon, feeds scenarios to MiroShark.
  x402 pay-per-call via USDC on Base — no subscription, no API key needed.
metadata:
  {
    "clawdbot":
      {
        "emoji": "🔵",
        "homepage": "https://github.com/madebyshun/blue-agent",
        "requires": { "bins": ["bankr"] },
      },
  }
---

# Blue Agent — Base-native AI for Builders

**31 CLI commands · 6 MCP tools · x402 pay-per-call on Base**

Idea → Build → Audit → Ship → Raise. Grounded in real Base knowledge, powered by Bankr LLM.

**Discovery:** `curl https://blueagent.dev/.well-known/agent.json`
**Collab hub:** `https://github.com/madebyshun/blue-agent/tree/main/collab`

---

## MCP Tools (via `npx skills add blueagent`)

| Tool | Price | Description |
|------|-------|-------------|
| `blue_idea` | $0.05 | Turn a rough concept into a fundable brief — problem, why now, why Base, MVP scope, risks, 24h plan |
| `blue_build` | $0.50 | Architecture, stack, folder structure, integrations, and test plan |
| `blue_audit` | $1.00 | Security and product risk review — critical issues, suggested fixes, go/no-go |
| `blue_ship` | $0.10 | Deployment checklist, verification steps, release notes, monitoring plan |
| `blue_raise` | $0.20 | Pitch narrative — market framing, why this wins, traction, ask, target investors |
| `blue_score` | Free | Builder Score for any Base wallet or Farcaster handle |

---

## CLI (via `npm install -g @blueagent/cli`)

**Workflow**
```bash
blue idea "USDC streaming payroll for DAOs on Base"
blue build "token-gated API with x402 payments"
blue audit "review this ERC-20 contract"
blue ship "deploy my Uniswap v4 hook to Base mainnet"
blue raise "pre-seed for my Base DeFi protocol"
```

**Score & Discovery**
```bash
blue score madebyshun          # Builder Score by GitHub/Farcaster handle
blue agent-score 0xADDRESS     # Agent reliability score
blue compare addr1 addr2       # Side-by-side reputation comparison
blue trending                  # Trending agents and tokens on Base
blue search "payroll"          # Search Base ecosystem
```

**Project Setup**
```bash
blue init                      # Install skills into current repo
blue new my-agent base-agent   # Scaffold new Base agent project
blue doctor                    # Check environment and API key
blue validate                  # Validate project health
```

**Work Hub**
```bash
blue tasks                     # Browse open tasks
blue post-task @handle         # Post a task with USDC escrow
blue accept <taskId> @handle   # Accept a task
blue submit <taskId> @handle <proof>  # Submit completed work
```

**Microtasks**
```bash
blue micro list                # Browse microtasks
blue micro post "description" --reward 1 --slots 3 --platform x
blue micro accept <id> @handle
blue micro submit <id> @handle <proof>
blue micro approve <id> @handle
blue micro profile @handle
```

**Other**
```bash
blue watch 0xADDRESS           # Watch wallet for activity
blue history 0xADDRESS        # Transaction and interaction history
blue alert                     # Manage alerts
blue chat                      # Interactive Bankr LLM chat
blue launch                    # Token or agent launch wizard
blue market                    # Browse agent marketplace
```

---

## Quick Start

```bash
# Install
npm install -g @blueagent/cli

# Configure API key
blue init
# → creates ~/.blue-agent/config.toml

# Verify
blue doctor

# Run your first command
blue idea "my Base project idea"
```

---

## Agent Collab

Blue Agent is collab-ready. It accepts signals from Aeon and feeds scenarios to MiroShark.

```bash
# Discover Blue Agent
curl https://blueagent.dev/.well-known/agent.json

# Send a signal
POST https://blueagent.dev/api/signal

# Request a simulation
POST https://blueagent.dev/api/simulate
```

Bridge files and shared schemas:
`https://github.com/madebyshun/blue-agent/tree/main/collab`

---

## Resources

- **Web:** https://blueagent.dev
- **GitHub:** https://github.com/madebyshun/blue-agent
- **npm:** https://npmjs.com/package/@blueagent/cli
- **Token:** $BLUEAGENT — `0xf895783b2931c919955e18b5e3343e7c7c456ba3` (Base)
- **Telegram:** https://t.me/blueagent_hub
- **X:** https://x.com/blocky_agent
- **Bankr:** https://bankr.bot/agent/blue-agent
