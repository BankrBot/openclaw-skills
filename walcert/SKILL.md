---
name: walcert
description: >-
  Issue A–F wallet-maturity certificates (origins, activity, multichain, portfolio)
  via Walcert’s public HTTP API. Use when the user or agent needs to judge a
  wallet before paying, tipping, launching a token, or interacting with an
  ERC-8004 agent. Free preview first; full signed certificate is x402 $0.05 USDC.
metadata:
  openclaw:
    homepage: https://walcert.globalscoreagent.com
---

# Walcert

Walcert (Global Score Agent) is a live ERC-8004 agent on **Celo** (agentId `9699`) that
issues **A–F wallet-maturity certificates**. Scoring runs on the public API. This
skill only teaches *when* and *how* to call that API. Do not reimplement scoring.
Do not proxy the API through another host.

## When to use

Use this skill when someone asks whether a wallet looks mature/legitimate, wants
an origins / activity / multichain / portfolio certificate, or wants to verify
an existing Walcert on-chain receipt.

Do **not** use this skill for token rug scans, HUMI/WAMI agent scores, or
ERC-8004 registration.

## Base URL

`https://walcert.globalscoreagent.com`

JSON body field is always `wallet_address` (checksum optional; 0x + 40 hex).

## Flow

1. **Preview** (free) for `origins` or `activity` unless the user already asked for
   a signed / on-chain certificate.
2. **Paid certificate** if they need signature + on-chain anchor, or the type is
   `multichain` / `portfolio` (preview returns 403).
3. **Verify** with the Celo `tx_hash` from `onchain` when they only have the receipt.

### Preview (no payment)

```http
POST /v1/preview/{origins|activity}
Content-Type: application/json

{"wallet_address":"0x…"}
```

Returns grade A–F + labels only. Rate limit: **8 requests / 15 min / IP** → 429
with `Retry-After`. `multichain` and `portfolio` preview → **403**.

### Full certificate (x402)

```http
POST /v1/certificates/{origins|activity|multichain|portfolio}
Content-Type: application/json

{"wallet_address":"0x…"}
```

Unauthenticated call → **402**. Retry with a valid PAYMENT-SIGNATURE.

- Price: **$0.05 USDC**
- **Default rail: Base** (`eip155:8453`, native USDC, EIP-3009). Pick `accepts[0]`
  unless the host cannot pay Base.
- Celo (`eip155:42220`) is also listed (Track 2).
- BNB (`eip155:56`, Permit2, Binance-Peg USDC) only if the host can sign Permit2 on
  BSC **and** will `claim` the soulbound receipt NFT afterwards. See
  `references/x402-rails.md`. Base/Celo payments do **not** mint an NFT.

### Verify (free)

```http
POST /v1/verify
Content-Type: application/json

{"tx_hash":"0x…"}
```

`tx_hash` is the Celo `giveFeedback` transaction (66-char hex). Optional:
`data_hash`, `certificate_id`.

## Identity (do not mix)

| Chain | agentId | Role |
|-------|---------|------|
| Celo | `9699` | Certificate issuer / on-chain anchor |
| Base | ACP listing | Marketplace identity, **not** the cert issuer |
| Ethereum | Agent City | Discovery only |

`payTo` is the operational EOA on the 402. Never pay from Owner or Monitor keys.
Never log private keys.

## Forbidden

- Wrapping or rehosting on `x402.bankr.bot` (or any x402 Cloud).
- Internal marketplace bypass / shared secrets.
- Paying preview endpoints.
- Treating Bankr/OpenClaw as a seller catalog — they only load this skill.

Details: `references/api.md`, `references/x402-rails.md`.
