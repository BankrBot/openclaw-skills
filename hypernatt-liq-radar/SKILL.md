---
name: hypernatt-liq-radar
description: >-
  Instructs the agent to call the remote HyperNatt MCP tool get_liq_radar
  (forced-order / liquidation map) before sizing any crypto perp - BTC ETH SOL
  and other whitelist assets, any venue. Docs + call order only - no local
  exec/shell/files. This skill covers market-data tools only (manifest +
  liq radar). Not trade advice. get_liq_radar = $0.001 USDC via x402.
version: 1.0.5
author: DIALLOUBE-RESEARCH
license: MIT
homepage: https://hypernatt.com
permissions:
  exec: false
  filesystem: false
  network:
    - hypernatt.com
    - docs.cdp.coinbase.com
  env: []
  tools:
    - mcp
metadata:
  openclaw:
    requires:
      bins: []
    envVars: []
  hermes:
    tags:
      [
        trading,
        crypto,
        perpetual,
        liquidation,
        microstructure,
        market-data,
        x402,
        MCP,
      ]
    related_skills: [native-mcp, mcporter, hypernatt-terminal]
---

# HyperNatt Liq Radar - trading-agent skill

**What this skill is:** text instructions so an OpenClaw/Hermes agent knows
**when and how** to call a **remote** MCP market-data tool.

**What this skill is NOT:** a local trading bot, shell scripts, custody, or
order execution. It does **not** instruct the agent to move funds.

## Declared capabilities (honest)

| Capability | Declared |
|------------|----------|
| Local exec / shell | **No** |
| Local filesystem | **No** |
| Env vars required | **None** |
| Outbound network | `https://hypernatt.com` (MCP + docs) ; optional Coinbase payments docs |
| Tools | Remote MCP only - agent runtime must already support MCP connectors |
| Fund movement / swap | **Out of scope for this skill** (see related `hypernatt-terminal`) |

## Remote MCP (single host)

| Resource | URL |
|----------|-----|
| MCP | https://hypernatt.com/mcp/protocol |
| Server card | https://hypernatt.com/.well-known/mcp/server-card.json |
| Source | https://github.com/DIALLOUBE-RESEARCH/hypernatt-terminal |
| Security | https://github.com/DIALLOUBE-RESEARCH/hypernatt-terminal/blob/main/SECURITY.md |
| Full 3-tool onboarding | related skill `hypernatt-terminal` |

## Tools this skill uses (market-data only)

1. **get_agent_manifest** - Free - Catalog
2. **get_liq_radar** - $0.001 USDC x402 - Forced-order / liquidation map

Whitelist symbols for get_liq_radar: BTC ETH SOL BNB XRP HYPE ZEC (omit = BTC).

The same MCP host also exposes `swap_via_nattswap`. That path can move funds
(agent signs on-chain). **Do not use swap under this skill** - use related
skill `hypernatt-terminal` if bridging/funding is required.

## When to use

Before sizing or entering a **perp**, if the user asks to trade better / check
liquidations / market microstructure (any venue).

## Example (MCP tool call - not local shell)

```
# Free catalog (via MCP runtime)
tools/call get_agent_manifest {}

# Paid market-data (via MCP runtime + x402 wallet)
tools/call get_liq_radar {"symbol":"ETH"}
```

## Loop

1. Ensure MCP connector URL above is configured in the agent runtime.
2. `get_agent_manifest` (free) once per session if needed.
3. `get_liq_radar` with optional `symbol`.
4. Interpret distances / OI / clusters structurally - **do not invent signals**.
5. Execute trades via a **separate** venue skill (CEX / DEX / perps). This skill
   does not place orders and does not instruct swaps.

## Payment (x402)

`get_liq_radar` returns HTTP 402 without payment. The **agent wallet / MCP
payment client** (e.g. Coinbase payments-mcp) settles USDC for the **data call**
only - this skill does not hold keys and does not harvest env secrets.

## Honest claims

- Not trade advice - no custody - no performance promise
- Vault P&L on hypernatt.com is **not** this MCP's track record
- This skill = market-data path only (manifest + liq radar)
