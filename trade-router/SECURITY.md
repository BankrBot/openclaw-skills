# Security Model

This document explains the security architecture of the Trade Router skill. It exists to address the "suspicious" verdict returned by static analysis tools (VirusTotal, ClawHub moderation, npm secret scanners) that cannot infer the non-custodial flow from observed behavior alone.

The skill describes a trading API. Two consumption modes ship in this repo: **(A) direct API integration** (see `SKILL.md` for the reference agent pattern) and **(B) the ready-made MCP server** (`@traderouter/trade-router-mcp` on npm / PyPI / MCP Registry). The trust model is identical across both — only the env-var conventions differ.

## TL;DR (both modes)

- **The private key never leaves the agent's machine.** It is read once from an environment variable, used for local Solana signing, and never transmitted, logged, or persisted.
- **api.traderouter.ai only receives signed transactions** — cryptographically sealed bundles that cannot be used to compromise the originating wallet.
- **Read-only operations (`/holdings`, `/mcap`, `/flex`) do not require any key.**
- **Server messages are Ed25519-verified** against a hard-coded trust anchor `EXX3nRzfDUvbjZSmxFzHDdiSYeGVP1EGr77iziFZ4Jd4`.

## Threat model

### What we protect against

| Threat | Mitigation |
|---|---|
| Private key exfiltration to remote service | Key never leaves the local process. Only signed transactions (which cannot be replayed beyond their single intended swap) are transmitted. |
| Key being logged/persisted on disk | Key is held in memory only for the signing operation. No log statement in the reference agent or MCP server includes the key. |
| Key being captured by a compromised dependency | Signing uses standard Solana libraries (`@solana/web3.js` + `tweetnacl` in the MCP server; `solders` in the Python port; `@solana/web3.js` in the reference agent). No custom crypto. |
| MITM attack on API calls | All requests use HTTPS to api.traderouter.ai. |
| Server impersonation of fills | Every `order_filled`, `order_created`, and `twap_execution` message is Ed25519-verified against the hard-coded trust anchor. Rotation is supported via a "next key" mechanism. |
| Signature verification bypass | Verification is fail-closed by default. Disabling it is an explicit opt-in. |
| Sandwich / MEV attacks on the swap | `/protect` submits via Jito bundles, preventing mempool visibility. |
| Slippage abuse | Slippage is included in the server-signed `params_hash`; altering it invalidates the signature. |

### What's out of scope

- User running the skill/MCP on a compromised machine (local key theft via malware is beyond our remit — user is responsible for operating system security).
- User revealing their private key via shell history, committed `.env` files, or exposed process env.
- Attacks on Solana itself (consensus, validator compromise).

## Data flow

```
┌──────────────────────────────────────────────────────────────┐
│ AGENT MACHINE                                                │
│                                                              │
│ 1. Private key env var ─────────► agent process              │
│                                     │                        │
│                                     │ (read once,            │
│                                     │  held in memory)       │
│                                     ▼                        │
│ 2. Agent calls swap action  Local signing                    │
│                             (@solana/web3.js + tweetnacl)    │
│                                     │                        │
└─────────────────────────────────────┼────────────────────────┘
                                      │
                                      │   (NETWORK boundary)
                                      ▼
  POST /swap    { wallet_address, token, amount, action }
  POST /holdings { wallet_address }
  GET  /mcap    { token_mint }
       ↓
  api.traderouter.ai returns an unsigned transaction
                                      │
                                      │   (back to local)
                                      ▼
┌──────────────────────────────────────────────────────────────┐
│ AGENT MACHINE                                                │
│                                                              │
│ 3. Unsigned tx signed with private key (local)               │
│ 4. SIGNED tx submitted to /protect                           │
│                                                              │
│       >>> THE PRIVATE KEY NEVER LEAVES THIS BOX <<<          │
│                                                              │
└──────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
  POST /protect { signed_tx_base64 }
       ↓
  Server submits to Jito bundle
  Returns { signature, pre/post balances } — Ed25519 signed
       ↓
  Client verifies signature against hard-coded trust anchor
  before treating the fill as authoritative.
```

## What each endpoint sends

| Endpoint | Request contents | Never includes |
|---|---|---|
| `POST /swap` | wallet_address (public key), token_mint, action (buy/sell), amount | Private key, seed phrase, any signing material |
| `POST /protect` | signed_tx_base64 (fully signed transaction) | Private key, unsigned tx |
| `POST /holdings` | wallet_address only | Private key, any auth material |
| `GET /mcap` | token_mint(s) | Anything user-specific |
| `GET /flex` | wallet + token (for PNG generation) | Private key |
| WebSocket `/ws` | wallet_address to register (challenge-signed), order params | Private key (signing happens client-side on fill) |

## Mode A — direct API integration (SKILL.md reference agent)

The reference agent example code in `SKILL.md` uses these conventions. **These are the agent's own choices, not required by the API.** If you're implementing from scratch, pick whatever names you like.

```yaml
env_vars (reference agent convention):
  PRIVATE_KEY: "Solana base58 key. Read once, used for local signing, never transmitted."
  DRY_RUN:
    default: "true"
    purpose: "Safe-by-default gate. Swap submissions only fire when DRY_RUN=false.
              A fresh agent runs paper-mode automatically; you must explicitly opt in
              to live trading."
  MAX_DAILY_LOSS_LAMPORTS:
    default: "2_000_000_000 (2 SOL)"
    purpose: "Activates the reference agent's KILL_SWITCH when cumulative same-day
              loss exceeds this. Halts all further submissions."
  KILL_SWITCH:
    default: "false"
    purpose: "Hard kill. Set true or triggered automatically by the daily-loss
              enforcement. Blocks submitTx and ws.send."
```

These guardrails live in the reference agent's own code, not in the API. Reimplementations can choose to skip them — the API accepts whatever the wallet signs — but we recommend keeping at least DRY_RUN and a daily-loss cap in any production agent.

## Mode B — MCP server (`@traderouter/trade-router-mcp`)

The MCP server published on npm (`@traderouter/trade-router-mcp`) and PyPI (`traderouter-mcp`) uses prefixed env vars for namespace hygiene when multiple MCP servers run in the same client:

```yaml
required_env_vars:
  TRADEROUTER_PRIVATE_KEY: "Required for any swap/order. Read once, used locally, never transmitted."

optional_env_vars:
  SOLANA_RPC_URL: "Defaults to https://api.mainnet-beta.solana.com. Used for local queries only."
  TRADEROUTER_SERVER_PUBKEY: "Override the baked-in server trust anchor. For testing or rotation."
  TRADEROUTER_SERVER_PUBKEY_NEXT: "Accept messages signed by this key in addition to the primary. Supports rotation without a client upgrade."
  TRADEROUTER_REQUIRE_SERVER_SIGNATURE: "Default 'true'. Set 'false' to skip fill-event verification — NOT RECOMMENDED."
  TRADEROUTER_REQUIRE_ORDER_CREATED_SIGNATURE: "Default 'true'. Set 'false' to skip order-created verification — NOT RECOMMENDED."

not_implemented_in_this_release:
  - Dry-run mode      # Reference agent (Mode A) has it. MCP server does not. Future release.
  - Daily loss cap    # Reference agent (Mode A) has it. MCP server does not. Future release.
  - On-disk tx log    # Server is stateless by design.

network_access:
  - api.traderouter.ai:443   # HTTPS for REST
  - api.traderouter.ai:443   # WSS for WebSocket (same host, upgrade)
  - SOLANA_RPC_URL host      # Only if set — direct Solana RPC for reads

filesystem_access:
  - read-only: none required
  - write: none required (stateless)

outbound_data:
  - wallet public addresses
  - token mints
  - swap parameters (amounts, slippage, expiry)
  - signed transactions
  NEVER:
  - private keys
  - seed phrases
  - unsigned transactions with key attached
  - keystore files
  - passwords
```

If you need dry-run or daily-loss behavior end-to-end with the MCP server, wrap the tool calls with your own gate, or use the Mode A reference agent pattern directly.

## User responsibilities

A perfect tool cannot protect you from the following — these are yours:

1. **Do not commit `.env` files to public repos.** Add `.env` to `.gitignore`.
2. **Do not export your private key in shells whose history is logged to shared systems** (shared servers, bastion hosts).
3. **Use a dedicated trading wallet with limited balance.** Treat it as a hot wallet, not your main holdings.
4. **Rotate keys periodically.** Every 30–90 days, move funds to a new wallet and stop using the old one.
5. **Run on trusted hardware.** Do not run this on a machine you don't control.
6. **Set reasonable slippage.** Low-liquidity tokens require 15–25%; your own risk tolerance applies.
7. **If you use the Mode B MCP server in production, wrap it.** The MCP server itself doesn't have a daily-loss cap — add one at your agent layer.

## Disclosure

Found a vulnerability? Email **security@traderouter.ai** or use GitHub Security Advisories on this repo.

We commit to:
- Acknowledge within 48 hours
- Fix critical issues within 7 days
- Credit the reporter publicly (with their consent)

## Audit status

- 2026-04-24: Self-audited, documentation-complete (this file). External audit pending.
- A formal audit from a reputable firm (Offside Labs / OtterSec / Zellic) is planned for Q2 2026.

## License

See `LICENSE`. MIT.
