---
name: ens-agent-identity
description: Give Bankr agents ENS-based identity with human-readable names, structured metadata, and on-chain verification. Use when the user wants to register an agent name, set agent text records, verify agent identity via ENSIP-25, resolve agent metadata, or make their agent discoverable via ENS.
---

# ENS Agent Identity

Give Bankr agents a full identity layer using ENS subnames, structured metadata via text records, and on-chain verification via ENSIP-25 + ERC-8004.

An ENS agent identity provides:
- **Human-readable name**: `alpha-go.bankr.eth` instead of `0x579b...9105`
- **Structured metadata**: Capabilities, chains, type, version — all discoverable via ENS resolution
- **On-chain verification**: ENSIP-25 links the ENS name to an ERC-8004 registry entry
- **Cross-platform portability**: Any ENS client can resolve and verify the agent

## Requirements

### Required: Bankr CLI

This skill requires the **Bankr CLI** for transaction signing:

```bash
bun install -g @bankr/cli
bankr login
```

### Required: NameStone API Key

Agent subnames are managed via NameStone (offchain ENS subname service). Obtain a free API key via SIWE at [namestone.com](https://namestone.com).

```bash
export NAMESTONE_API_KEY="your-api-key"
```

### Required: Node.js + viem

Scripts use Node.js with `viem` for ENS resolution and ABI encoding. Install in a local project directory:

```bash
npm init -y && npm install viem
```

## Quick Start

```bash
# Register an agent and set metadata
./scripts/set-agent-records.sh alpha-go trading-bot "swap,bridge,limit-order"

# Resolve an agent's ENS name and metadata
./scripts/resolve-agent.sh alpha-go.bankr.eth

# Verify ENSIP-25 link between ENS name and ERC-8004 identity
./scripts/verify-agent-registration.sh alpha-go.bankr.eth 42

# Phase A (AuthResolver pilot, scaffold): publish auth.* records, then read-only verify
BANKR_ENS_DOMAIN=bankrtest.eth AUTH_SIGNER_ADDRESS=0x… AUTH_SCOPE="swap,bridge" \
  ./scripts/publish-auth-records.sh authtest primary
NODE_NO_WARNINGS=1 node ./scripts/verify-action.ts authtest.bankrtest.eth primary
```

## Agent Text Record Schema

Every Bankr agent stores structured metadata as ENS text records under the `agent:*` namespace:

| Text Record | Purpose | Example |
|---|---|---|
| `agent:type` | Agent classification | `trading-bot`, `portfolio-manager`, `token-launcher` |
| `agent:capabilities` | Comma-separated capabilities | `swap,bridge,limit-order,dca` |
| `agent:chains` | Supported chains | `base,ethereum,polygon` |
| `agent:a2a` | Agent-to-Agent API endpoint | `https://api.bankr.bot/agent/xyz` |
| `agent:version` | Agent version | `2.1.0` |
| `agent:creator` | Creator's ENS name | `estmcmxci.eth` |
| `agent:token` | Deployed token address | `0x842cfeb...` |
| `agent:delegation` | Parent agent delegation | `treasury.bankr.eth` |
| `agent:policy` | Access policy | `read-only`, `full-access`, `scoped` |
| `agent:mode` | Operating mode | `autonomous`, `supervised` |
| `agent:chainId` | Primary chain ID | `8453` |

See `references/agent-text-record-schema.md` for the full schema specification.

## ENSIP-25 Verification

ENSIP-25 links an ENS name to an ERC-8004 registry entry via a parameterized text record:

```
agent-registration[<registry>][<agentId>] = "1"
```

This allows any client to verify that the ENS name owner endorses the association with a specific on-chain agent identity. See `references/ensip-25-verification.md` for details.

## Phase A: AuthResolver Read-Only Pilot

> **Forward-declaring scaffold — not contract work.** This is **layer 3 (Authentication)** on
> top of the existing layer-1 (ENSIP-25 identity) and layer-2 (`agent:*` attribution) records.
> It publishes `auth.*` records and runs a **read-only** verification mirror. The contracts
> that consume these records — the **Verifier** + **AuthResolverImpl** — are the **unfunded M1
> deliverable** (target 2026-08-31, `github.com/steg-eth`) and are **not deployed**. Nothing
> here performs end-to-end signature verification; it proves the **record plumbing**.
>
> The `auth.*` key naming and record shapes come from the AuthResolver spec; **how they map to a
> specific platform's real auth model is a design conversation with that platform's engineers**,
> not fixed here.

**What Phase A proves:** an agent can publish credential / capability / revocation records on
its ENS name without clobbering its existing identity/attribution records, and a counterparty
can resolve + read + structurally pre-check them along the spec's `verifyAction` ordering. It
**does not alter any production execution path** — it is a counterparty-side, read-only observer.

**Records** (full schema in `references/auth-record-schema.md`):

| Key | Purpose | Consumed by `verifyAction`? |
|---|---|---|
| `auth.credential[<id>]` | signing key + scheme + validity window | yes (M1) |
| `auth.capability[<id>]` | scope declaration | no — reserved for v1.1 |
| `auth.revocation[<id>]` | revocation flag (any bytes ⇒ revoked) | yes (M1) |

Phase-A records are **JSON-in-text-record** — a deliberate simplification that migrates to
`setData` + CBOR once the M1 `AuthResolverImpl` is deployed.

**Prerequisites:** `NAMESTONE_API_KEY` (publish half) + Node 24 with `viem` (already installed
in `ens-agent-identity/`). The on-chain verify step additionally needs the **deployed M1
AuthResolver** and `AUTH_RESOLVER_ADDRESS` — **pending M1**; until then the verifier runs in
demo mode.

```bash
# 1. Publish auth.* WITHOUT clobbering existing agent:*/ENSIP-25 records (read-merge-write)
BANKR_ENS_DOMAIN=bankrtest.eth AUTH_SIGNER_ADDRESS=0x… AUTH_SCOPE="swap,bridge,limit-order" \
  ./scripts/publish-auth-records.sh authtest primary

# 2. (Real signature) produce a secp256k1 signature via Bankr's /agent/sign — unchanged endpoint

# 3. Verify (read-only; on-chain verifyAction STUBBED pending M1)
NODE_NO_WARNINGS=1 node ./scripts/verify-action.ts authtest.bankrtest.eth primary
#   => "contract not deployed yet; record plumbing verified"  (verified: null)
```

The verifier's `verifyAction` ABI is a **design sketch** (spec §5.1), marked `// TODO(M1)`. See
`references/phase-a-demo.md` for the full 5-minute demo incl. deny-path and fail-path examples.

## Architecture

```
                    resolve name
User / Agent  ──────────────────>  ENS Name
                                   (agent.bankr.eth)
                                        |
              +--------------+----------+-----------+--------------+
              v              v          v           v              v
        Wallet Address  Text Records  ENSIP-25   ERC-8004 NFT  Reputation
        (addr record)   (agent:*)     Verification (Identity)  (ERC-8004)
```

## Namespace

**Parent domain**: Configurable via `BANKR_ENS_DOMAIN` env var (default: `bankr.eth`)

- Any `.eth` domain onboarded to NameStone can be used as the parent namespace
- Subnames registered via NameStone API (gasless, offchain)
- Universal resolution from any ENS client on any chain
- Resolver: NameStone Hybrid Resolver (`0xA87361C4E58B619c390f469B9E6F27d759715125`)

## Lifecycle

1. **Agent created** -> register `name.bankr.eth` via NameStone -> set `agent:*` text records
2. **ERC-8004 registered** -> set ENSIP-25 verification record
3. **Agent deactivated** -> clear ENSIP-25 record -> release subname
4. **Name transferred** -> verification automatically invalidated

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "NameStone API key not set" | Export `NAMESTONE_API_KEY` or get one at namestone.com |
| "Name already taken" | Choose a different subname under `bankr.eth` |
| "Resolution failed" | Check that NameStone resolver is set on `bankr.eth` |
| "ENSIP-25 verification failed" | Ensure the text record matches the registry address and agent ID |
| "Bankr CLI not found" | Install with `bun install -g @bankr/cli && bankr login` |

## Links

- ENS Docs: https://docs.ens.domains
- NameStone: https://namestone.com
- ENSIP-25 Spec: https://docs.ens.domains/ensip/25/
- ERC-8004: https://eips.ethereum.org/EIPS/eip-8004
- Oikonomos: https://github.com/estmcmxci/oikonomos
