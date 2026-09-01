---
name: xelqor
description: >
  Interact with the Xelqor Protocol — a composable DeFAI strategy marketplace on 18+ networks.
  Use this skill to: browse and discover published strategy pipelines in the marketplace,
  compose new MCP-powered strategy pipelines (AI Builder or Manual Composer mode),
  fork existing strategies, invest capital into strategies via ERC-4626 vaults,
  simulate pipeline execution, export pipelines as YAML, and read live protocol data
  (TVL, APY, Sharpe) from DeFiLlama. All strategy pipelines are built from MCP tool nodes
  that execute autonomously across chains.
version: 2.0.0
author: Xelqor
website: https://xelqor.xyz
tags:
  - defi
  - strategy-marketplace
  - mcp-pipelines
  - multi-chain
  - composable
  - erc4626-vaults
---

# Xelqor Protocol Skill

Xelqor is a **composable DeFAI strategy marketplace**. Builders design MCP-powered pipelines using a visual composer. Allocators browse the marketplace, invest via permissioned ERC-4626 vaults, and let autonomous agents handle execution across 18+ chains.

## Install

```
install the xelqor skill from https://github.com/BankrBot/skills/tree/main/xelqor
```

---

## Core Primitives

| Primitive | What it is |
|---|---|
| **Strategy Pipeline** | A graph of MCP tool nodes — triggers, actions, logic, oracles, AI nodes, outputs — wired together and executed autonomously |
| **Marketplace** | Published pipelines browsable by category, APY, TVL, Sharpe, risk level, and network |
| **Vault** | Audited ERC-4626 contract that accepts capital and allocates it into the strategy |
| **Composer** | Visual drag-and-drop canvas to build pipelines; supports AI Builder mode (plain-English intent) and Manual Composer mode |
| **MCP Tools** | The atomic building blocks — `swapEvm()`, `depositYearn()`, `openPerp()`, `bridgeTokens()`, `monitorOracle()`, etc. — provided by HeyAnon |

---

## Marketplace Operations

### Browse strategies

```
GET https://xelqor.xyz/api/strategies
  ?category=Yield|Arbitrage|Perps|LP|Delta-Neutral|Cross-Chain
  &sort=apy|tvl|sharpe|newest
  &risk=Low|Medium|High
  &search=<query>
```

Each strategy object:
```json
{
  "id": "yield-max-stable",
  "name": "YieldMax Stable",
  "category": "Yield",
  "description": "Auto-compounds stable yields across Aave v3, Yearn, Compound…",
  "author": "yieldmax.eth",
  "status": "live",
  "risk": "Low",
  "apy": 0.184,
  "tvl": 2100000,
  "sharpe": 2.41,
  "maxDrawdown": 0.008,
  "tags": ["USDC", "AAVE", "Yearn"],
  "networks": ["Ethereum", "Base"],
  "mcpTools": ["depositYearn()", "withdrawAave()", "monitorOracle()"],
  "pipesRun": 8420,
  "verified": true
}
```

### Invest in a strategy (vault deposit)

1. Browse marketplace to find strategy by `id`
2. Call `openDepositModal(strategyId)` — this opens the ERC-4626 vault deposit flow
3. User approves token + deposit amount; vault mints shares

### Fork a strategy pipeline

POST to `/api/strategies/{id}/fork` — clones all nodes and edges into a new editable pipeline under the user's wallet.

---

## Pipeline Composition

### AI Builder mode (recommended for agents)

Send a plain-English intent to the MCP agent via `/api/mcp`:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "invoke",
    "arguments": {},
    "_intent": "Build a low-risk yield strategy on 10k USDC across Aave and Yearn on Base",
    "_meta": {
      "risk_preference": "Low",
      "capital_usd": 10000,
      "network": "Base"
    }
  }
}
```

Response includes:
- `response` — natural language strategy analysis
- `strategy_summary` — `{ name, expected_apy, risk_level, tvl }`
- `recommended_actions` — ordered list of MCP tool steps

The agent maps each recommended action to a pipeline node automatically.

**Note:** Each invoke call requires an x402 micropayment ($5 SOL or $4 ANON with 20% discount) on Solana mainnet.

### Manual Composer mode

Build pipelines node by node. Node types and their roles:

| Type | Color | Role |
|---|---|---|
| `trigger` | teal | Entry point — time, price event, APY threshold, wallet balance |
| `action` | purple | On-chain execution — swap, lend, LP, harvest, bridge |
| `logic` | amber | Conditional branching — if/else, human approval, timelock, AI decision |
| `oracle` | green | Data feeds — Chainlink price, DeFiLlama TVL |
| `ai` | purple | AI optimization — allocation optimizer, risk assessment |
| `output` | teal | Exit — deposit to vault, send to wallet, compound, emergency exit |

### Available node templates (triggers)

| Node | Description | Key params |
|---|---|---|
| `trigger-time` | Cron schedule | `cron: hourly\|daily\|weekly\|monthly` |
| `trigger-price` | Oracle price threshold | `token`, `condition: above\|below\|crosses`, `threshold` |
| `trigger-apy` | APY monitoring event | `protocol: Morpho\|Aave\|Compound\|Spark`, `apy` |
| `trigger-wallet` | Balance threshold | `token`, `amount` |

### Available node templates (actions)

| Node | Gas | Protocols | Key params |
|---|---|---|---|
| `action-swap` | ~120K | Uniswap V4 | `tokenIn`, `tokenOut`, `slippage`, `allocation %` |
| `action-lend` | ~85K | Morpho, Aave V3, Compound V3, Spark | `protocol`, `asset`, `allocation %` |
| `action-lp` | ~200K | Uniswap V4 | `pool`, `rangeMin`, `rangeMax`, `allocation %` |
| `action-harvest` | ~60K | any | `compound: bool`, `minReward $` |
| `action-bridge` | ~180K | intent solver | `from`, `to`, `token` |

### Available node templates (logic, oracle, AI, output)

| Node | Description |
|---|---|
| `logic-ifelse` | Branch on volatility / APY / price / TVL / gasPrice |
| `logic-approval` | Human sign-off gate with timeout and fallback |
| `logic-timelock` | Safety delay (1–168 hrs) |
| `logic-agent` | AI chooses branch: maximize_yield / minimize_risk / maximize_sharpe / reduce_gas |
| `oracle-price` | Chainlink: ETH/USD, BTC/USD, USDC/USD, LINK/USD |
| `oracle-tvl` | DeFiLlama TVL feed for any protocol |
| `ai-optimize` | Optimize allocation by Sharpe, yield, risk-adjusted, or min-drawdown |
| `ai-risk` | Real-time risk scorer — set max acceptable risk score |
| `output-vault` | Deposit into ERC-4626 vault |
| `output-wallet` | Send % of assets to wallet |
| `output-compound` | Re-invest yield back into strategy |
| `output-exit` | Emergency full unwind (use `action-bridge` first for cross-chain) |

---

## Pre-built Strategy Templates

Use these as starting points:

| Template | Risk | Target APY | Description |
|---|---|---|---|
| `stable-yield` | Low | 8–12% | USDC → Morpho lending + weekly harvest compound |
| `delta-neutral` | Medium | 18–30% | LP + hedge — capture fees, zero directional exposure |
| `rwa-allocator` | Low | 5–8% | Tokenised RWA + AI rebalancing on APY threshold |
| `leveraged-lp` | High | 40–80% | Borrow against collateral → LP → harvest loop |

To load a template, pass `templateId` to the composer `/dapp/composer?template=stable-yield`.

---

## Pipeline Simulation

POST to `/api/execute` with pipeline nodes and edges. Returns a Server-Sent Events stream with:

- **log events** — step-by-step execution trace
- **result event** — `{ estimated_apy, sharpe_ratio, max_drawdown_pct, gas_estimate_usd, risk_score, warnings, protocols_live, recommended_actions }`

Request shape:
```json
{
  "nodes": [
    { "id": "n1", "defId": "trigger-time", "label": "Weekly Trigger", "params": { "cron": "weekly" } },
    { "id": "n2", "defId": "action-lend",  "label": "Lend USDC",      "params": { "protocol": "Morpho", "asset": "USDC", "allocation": 90 } }
  ],
  "edges": [{ "from": "n1", "to": "n2" }],
  "strategyName": "My Stable Strategy",
  "mode": "test"
}
```

Set `"mode": "deploy"` to go live.

---

## Live Protocol Data (DeFiLlama)

GET `/api/protocol-data?protocols=Morpho,Aave&chains=Base,Ethereum`

Returns per-protocol: TVL, top pools with current APY, 30-day mean APY, 1-day APY change, and DeFiLlama pool URL.

---

## Pipeline Export

Pipelines can be exported as YAML for version control or marketplace submission:

```yaml
name: "My Strategy"
version: "1.0"
nodes:
  - id: n1
    type: trigger
    label: "Weekly Trigger"
    tool: trigger-time
  - id: n2
    type: action
    label: "Lend USDC"
    tool: action-lend
edges:
  - source: n1
    target: n2
```

---

## MCP Tool Catalogue (HeyAnon, 360+ tools)

Key tools agents should know:

| Tool | Category | Networks |
|---|---|---|
| `swapEvm()` | DEX | Ethereum, Base, Arbitrum, Optimism |
| `depositYearn()` | Yield | Ethereum, Base |
| `withdrawAave()` | Lending | Ethereum, Base, Arbitrum |
| `openPerp()` | Derivatives | Arbitrum (GMX), Hyperliquid |
| `closePosition()` | Derivatives | Arbitrum, Hyperliquid |
| `bridgeTokens()` | Bridge | Ethereum, Base, Arbitrum, Optimism, Polygon |
| `queryPriceFeeds()` | Data | All chains |
| `rebalanceLP()` | Liquidity | Ethereum, Base, Arbitrum |
| `monitorOracle()` | Data | All chains |
| `farmKamino()` | Yield | Solana |
| `stakeSol()` | Staking | Solana |
| `routeHyperliquid()` | Derivatives | Hyperliquid |

---

## Example Agent Prompts

```
"Browse the Xelqor marketplace and show me the top 3 yield strategies by Sharpe ratio"
"Build me a delta-neutral ETH strategy pipeline with 18–30% target APY on Xelqor"
"Fork the YieldMax Stable strategy and increase the Morpho allocation to 95%"
"Simulate this pipeline and tell me the estimated APY and risk score"
"What protocols does the Arb Loop v2 strategy use and on which chains?"
"Compose an AI pipeline: low-risk USDC yield across Aave and Yearn, auto-compound weekly"
"What's the current APY on Morpho USDC pools? Should I rebalance?"
"Deploy my stable-yield pipeline to mainnet on Xelqor"
"Export my pipeline as YAML and publish it to the marketplace"
"Invest 5000 USDC into the YieldMax Stable strategy vault"
```

---

## Networks

Xelqor pipelines support 18+ networks including: Ethereum, Base, Arbitrum, Optimism, Polygon, Solana, Hyperliquid, and more via HeyAnon MCP bridges.

## Resources

- App: https://xelqor.xyz/dapp/composer
- Marketplace: https://xelqor.xyz/dapp/marketplace
- Docs: https://xelqor.xyz/docs
- MCP API: `/api/mcp` (JSON-RPC 2.0, proxied to HeyAnon)
- Execute API: `/api/execute` (SSE stream)
- Protocol data: `/api/protocol-data` (DeFiLlama)
