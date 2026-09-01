# v402 Protocol Specification Summary

## Protocol Flow

```
Agent                            Gateway                          Solana
  │                                │                                │
  │── GET /api/tool ──────────────▶│                                │
  │◀─ 402 + V402-Intent ──────────│                                │
  │                                │                                │
  │── sign + send USDC tx ────────────────────────────────────────▶│
  │◀─ tx_signature ───────────────────────────────────────────────│
  │                                │                                │
  │── GET /api/tool ──────────────▶│                                │
  │   + V402-Payment header        │── verify on-chain (RPC) ─────▶│
  │                                │◀─ confirmed ─────────────────│
  │                                │── check spending policy        │
  │                                │── forward to tool server       │
  │◀─ 200 + V402-Receipt ────────│                                │
```

## V402-Intent Header Format

Returned in the 402 response. JSON object:

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | string | yes | Unique intent identifier |
| `amount` | string | yes | Payment amount (decimal string, e.g. "0.002") |
| `currency` | string | yes | "USDC" or "SOL" |
| `recipient` | string | yes | Merchant Solana wallet address (base58) |
| `merchant` | string | yes | Alias for recipient |
| `reference` | string | yes | Unique reference for idempotency |
| `tool_id` | string | no | Tool being paid for |
| `tool_params_hash` | string | no | SHA-256 hash of tool parameters |
| `session_id` | string | no | Session ID for multi-call billing |
| `max_calls` | number | no | Max calls per session |
| `expires_at` | number | yes | Unix timestamp when intent expires |
| `memo` | string | no | Transaction memo |

## V402-Payment Header Format

Sent by the client on the retry request. JSON object:

| Field | Type | Required |
|---|---|---|
| `intent_id` | string | yes |
| `tx_signature` | string | yes |
| `payer` | string | yes |

## V402-Receipt Header Format (v2)

Returned by the gateway on success. JSON object:

| Field | Type | Description |
|---|---|---|
| `version` | number | Receipt version (2) |
| `intent_id` | string | Original intent ID |
| `tx_signature` | string | Solana transaction signature |
| `amount` | string | Payment amount |
| `currency` | string | USDC or SOL |
| `payer` | string | Payer wallet (derived from chain) |
| `merchant` | string | Merchant wallet |
| `tool_id` | string | Tool that was paid for |
| `timestamp` | number | Unix timestamp |
| `block_height` | number | Solana block height |
| `receipt_hash` | string | SHA-256 hash of canonical receipt |
| `signature` | string | Ed25519 signature of receipt_hash |
| `signer_pubkey` | string | Public key of the signer |

## Key Properties

- **Non-custodial**: Server never touches user keys. Payments go wallet-to-wallet.
- **No facilitator**: On-chain verification via Solana RPC. No middleman holding funds (unlike x402's Coinbase facilitator).
- **Payer derivation**: Payer is always derived from the on-chain transaction (fee payer for SOL, token account owner for USDC). Never trust client-supplied payer.
- **Portable receipts**: Ed25519 signatures can be verified by anyone without contacting the gateway.
- **Idempotency**: Unique `reference` in the transaction memo prevents double-spending.
- **Tool-aware**: Intents are scoped to specific tools, enabling per-tool policies and auditing.
- **Session billing**: One payment covers N tool calls within a session via `session_id` and `max_calls`.

## Spending Policy

| Field | Type | Default | Description |
|---|---|---|---|
| `dailyCap` | number | 5.0 | Maximum spend per UTC day |
| `perCallCap` | number | 1.0 | Maximum per single tool call |
| `allowedTools` | string[] | [] (all) | Tool IDs the agent may pay for |
| `allowedMerchants` | string[] | [] (all) | Merchant addresses the agent may pay |
| `expiresAt` | Date | none | When the policy expires |

## v402 vs x402

| Feature | x402 | v402 |
|---|---|---|
| Facilitator | Required (Coinbase) | None — direct on-chain |
| Spending controls | None | Daily caps, per-call limits, allowlists |
| Receipts | No | Ed25519 signed, portable |
| Tool awareness | No | Tool-scoped intents |
| Session billing | No | Yes — one payment, N calls |
| Chain | Base (EVM) | Solana (400ms finality) |
| Custody | Semi-custodial | Non-custodial |
